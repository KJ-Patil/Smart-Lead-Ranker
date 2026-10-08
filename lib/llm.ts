import { z } from "zod";
import type { LLMResponse, EnrichmentData, ICPProfile } from "./types";

const LLMResponseSchema = z.object({
  score_reason: z.string(),
  outreach_angle: z.string(),
  confidence: z.number().min(0).max(1),
  evidence_urls: z.array(z.string()),
});

type LLMProvider = "mock" | "gemini" | "groq" | "claude";

function getProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER as LLMProvider) || "mock";
}

function buildPrompt(enrichment: EnrichmentData, icp: ICPProfile): string {
  return `You are a sales intelligence assistant. Based ONLY on the scraped data below, provide:
1. A one-line reason why this lead is relevant (or not) to the target customer profile.
2. A suggested outreach angle for a salesperson.
3. Your confidence as a decimal number between 0.0 and 1.0 (e.g. 0.85).
4. URLs from the scraped data that support your reasoning.

TARGET CUSTOMER PROFILE:
- Industry keywords: ${icp.industry_keywords.join(", ")}
- Company size: ${icp.company_size_min}-${icp.company_size_max} employees
- Region: ${icp.region}
- Target roles: ${icp.target_roles.join(", ")}

SCRAPED DATA:
- Summary: ${enrichment.summary}
- Size signals: ${enrichment.size_signals.join(", ") || "none found"}
- Hiring signals: ${enrichment.hiring_signals.join(", ") || "none found"}
- Keyword matches: ${enrichment.keyword_matches.join(", ") || "none"}
- Source URLs: ${enrichment.source_urls.join(", ")}

Respond in strict JSON with keys: score_reason, outreach_angle, confidence, evidence_urls. No other text.`;
}

function mockReason(enrichment: EnrichmentData, icp: ICPProfile): LLMResponse {
  const keywordHits = enrichment.keyword_matches.length;
  const hasHiring = enrichment.hiring_signals.length > 0;
  const hasContact = enrichment.emails.length > 0;
  const totalKeywords = icp.industry_keywords.length || 1;
  const matchRatio = keywordHits / totalKeywords;

  let reason = "";
  if (matchRatio >= 0.5 && hasHiring) {
    reason = `Strong ICP match (${keywordHits}/${totalKeywords} keywords) with active hiring signals.`;
  } else if (matchRatio >= 0.5) {
    reason = `Good ICP match (${keywordHits}/${totalKeywords} keywords) but no hiring signals detected.`;
  } else if (hasHiring) {
    reason = `Weak keyword match but actively hiring — may be expanding into relevant areas.`;
  } else {
    reason = `Limited match to target profile. ${keywordHits}/${totalKeywords} keywords found.`;
  }

  let angle = "Introduce your solution and ask about their current needs.";
  if (hasHiring) {
    angle = `They're hiring — pitch how your solution helps new teams ramp faster.`;
  } else if (hasContact) {
    angle = `Direct contacts available — personalize outreach around their ${enrichment.summary.slice(0, 60)}.`;
  }

  return {
    score_reason: reason,
    outreach_angle: angle,
    confidence: matchRatio >= 0.5 ? 0.7 : 0.4,
    evidence_urls: enrichment.source_urls.slice(0, 3),
  };
}

const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"];

async function callGemini(prompt: string): Promise<LLMResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (res.status === 503 || res.status === 429) {
        lastError = new Error(`${model}: ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");
      return JSON.parse(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}

async function callGroq(prompt: string): Promise<LLMResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return JSON.parse(text);
}

export async function generateLeadInsight(
  enrichment: EnrichmentData,
  icp: ICPProfile
): Promise<LLMResponse> {
  const provider = getProvider();

  if (provider === "mock") {
    return mockReason(enrichment, icp);
  }

  const prompt = buildPrompt(enrichment, icp);
  let raw: unknown;

  try {
    if (provider === "gemini") {
      raw = await callGemini(prompt);
    } else if (provider === "groq") {
      raw = await callGroq(prompt);
    } else {
      return mockReason(enrichment, icp);
    }

    const parsed = LLMResponseSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    // Retry once on invalid JSON
    if (provider === "gemini") {
      raw = await callGemini(prompt + "\nYour previous response was invalid JSON. Try again.");
    } else {
      raw = await callGroq(prompt + "\nYour previous response was invalid JSON. Try again.");
    }

    const retry = LLMResponseSchema.safeParse(raw);
    if (retry.success) return retry.data;
  } catch {
    // Fall back to mock on any error
  }

  return mockReason(enrichment, icp);
}
