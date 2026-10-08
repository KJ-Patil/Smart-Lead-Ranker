import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import Papa from "papaparse";
import { store } from "@/lib/store";
import { normalizeDomain, deduplicateLeads } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const MAX_ROWS = 200;

const UploadSchema = z.object({
  icp_id: z.string().uuid(),
  csv_content: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const icpId = request.nextUrl.searchParams.get("icp_id");
  if (icpId) {
    return Response.json(await store.leads.getByICP(icpId));
  }
  return Response.json(await store.leads.getAll());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UploadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const icp = await store.icp.get(parsed.data.icp_id);
    if (!icp) {
      return Response.json({ error: "ICP profile not found" }, { status: 404 });
    }

    const result = Papa.parse<Record<string, string>>(parsed.data.csv_content, {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      return Response.json(
        { error: "CSV parse errors", details: result.errors.slice(0, 5) },
        { status: 400 }
      );
    }

    if (result.data.length > MAX_ROWS) {
      return Response.json(
        { error: `Maximum ${MAX_ROWS} rows allowed. Got ${result.data.length}.` },
        { status: 400 }
      );
    }

    const rawLeads = result.data
      .filter((row) => row.company_name && row.website)
      .map((row) => ({
        id: uuidv4(),
        icp_id: parsed.data.icp_id,
        company_name: row.company_name.trim(),
        website: row.website.trim(),
        domain: normalizeDomain(row.website),
        contact_name: row.contact_name?.trim() || undefined,
        contact_email: row.contact_email?.trim() || undefined,
        status: "new" as const,
        score: 0,
        score_breakdown: {
          icp_match: 0,
          size_fit: 0,
          hiring_signal: 0,
          contactability: 0,
          data_completeness: 0,
        },
        data_quality: "low" as const,
        completeness: 0,
        created_at: new Date().toISOString(),
      }));

    const deduped = deduplicateLeads(rawLeads);

    for (const lead of deduped) {
      await store.leads.set(lead as Lead);
    }

    return Response.json(
      {
        uploaded: rawLeads.length,
        deduplicated: deduped.length,
        leads: deduped,
      },
      { status: 201 }
    );
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
