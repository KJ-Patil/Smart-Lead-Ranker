import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { enrichCompany } from "@/lib/scraper";
import { scoreLead } from "@/lib/scoring";
import { generateLeadInsight } from "@/lib/llm";
import { sleep } from "@/lib/utils";
import type { EnrichmentData, Job } from "@/lib/types";

const BATCH_SIZE = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { icp_id, force } = body;

    if (!icp_id) {
      return Response.json({ error: "icp_id required" }, { status: 400 });
    }

    const icp = await store.icp.get(icp_id);
    if (!icp) {
      return Response.json({ error: "ICP not found" }, { status: 404 });
    }

    const allLeads = await store.leads.getByICP(icp_id);

    if (force) {
      await store.cache.clearAll();
      for (const lead of allLeads) {
        lead.enrichment = undefined;
        lead.score = 0;
        lead.llm_reason = undefined;
        lead.outreach_angle = undefined;
        lead.score_breakdown = { icp_match: 0, size_fit: 0, hiring_signal: 0, contactability: 0, data_completeness: 0 };
        lead.data_quality = "low";
        lead.completeness = 0;
        await store.leads.set(lead);
      }
    }

    const leads = force ? allLeads : allLeads.filter((l) => !l.enrichment);
    if (leads.length === 0) {
      return Response.json({ error: "No leads to enrich" }, { status: 400 });
    }

    const job: Job = {
      id: uuidv4(),
      icp_id,
      status: "processing",
      total_leads: leads.length,
      processed_leads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.jobs.set(job);

    processInBackground(job.id, icp_id);

    return Response.json({ job_id: job.id, total: leads.length }, { status: 202 });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function processInBackground(jobId: string, icpId: string) {
  const icp = await store.icp.get(icpId);
  if (!icp) return;

  const allLeads = await store.leads.getByICP(icpId);
  const leads = allLeads.filter((l) => !l.enrichment);
  const job = await store.jobs.get(jobId);
  if (!job) return;

  try {
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          const cached = (await store.cache.get(lead.domain)) as (EnrichmentData & { needs_review?: boolean }) | null;
          let enrichment: EnrichmentData & { needs_review?: boolean };

          if (cached) {
            enrichment = cached;
          } else {
            enrichment = await enrichCompany(lead.domain, icp);
            await store.cache.set(lead.domain, enrichment);
          }

          if (enrichment.needs_review) {
            lead.status = "needs_review";
          }

          const hasUsableData =
            enrichment.summary !== "unknown" ||
            enrichment.emails.length > 0 ||
            enrichment.phones.length > 0 ||
            enrichment.hiring_signals.length > 0;

          if (!hasUsableData && !enrichment.needs_review) {
            lead.data_quality = "low";
            lead.completeness = 0;
            lead.score = 0;
            lead.enrichment = enrichment;
            await store.leads.set(lead);
            return;
          }

          const { score, breakdown, quality, completeness } = scoreLead(enrichment, icp);

          await sleep(300);
          const llmResult = await generateLeadInsight(enrichment, icp);

          lead.enrichment = enrichment;
          lead.score = score;
          lead.score_breakdown = breakdown;
          lead.data_quality = quality;
          lead.completeness = completeness;
          lead.llm_reason = llmResult.score_reason;
          lead.outreach_angle = llmResult.outreach_angle;

          await store.leads.set(lead);
        })
      );

      job.processed_leads += batch.length;
      job.updated_at = new Date().toISOString();
      await store.jobs.set(job);
    }

    job.status = "completed";
  } catch {
    job.status = "failed";
  }

  job.updated_at = new Date().toISOString();
  try {
    await store.jobs.set(job);
  } catch {
    // Store unavailable — job status lost but won't crash the server
  }
}
