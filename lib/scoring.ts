import type { EnrichmentData, ICPProfile, ScoreBreakdown } from "./types";

export function scoreLead(
  enrichment: EnrichmentData,
  icp: ICPProfile
): { score: number; breakdown: ScoreBreakdown; quality: "high" | "medium" | "low"; completeness: number } {
  const breakdown: ScoreBreakdown = {
    icp_match: calcICPMatch(enrichment, icp),
    size_fit: calcSizeFit(enrichment, icp),
    hiring_signal: calcHiringSignal(enrichment),
    contactability: calcContactability(enrichment),
    data_completeness: calcDataCompleteness(enrichment),
  };

  const weights = {
    icp_match: 0.30,
    size_fit: 0.15,
    hiring_signal: 0.20,
    contactability: 0.20,
    data_completeness: 0.15,
  };

  const score = Math.round(
    breakdown.icp_match * weights.icp_match +
    breakdown.size_fit * weights.size_fit +
    breakdown.hiring_signal * weights.hiring_signal +
    breakdown.contactability * weights.contactability +
    breakdown.data_completeness * weights.data_completeness
  );

  const completeness = calcCompleteness(enrichment);
  const quality = completeness >= 70 ? "high" : completeness >= 40 ? "medium" : "low";

  return { score, breakdown, quality, completeness };
}

function calcICPMatch(enrichment: EnrichmentData, icp: ICPProfile): number {
  if (icp.industry_keywords.length === 0) return 50;
  const matches = enrichment.keyword_matches.length;
  const ratio = matches / icp.industry_keywords.length;
  return Math.min(100, Math.round(ratio * 100));
}

function calcSizeFit(enrichment: EnrichmentData, icp: ICPProfile): number {
  if (enrichment.size_signals.length === 0) return 30;

  const sizeText = enrichment.size_signals.join(" ").toLowerCase();
  const numbers = (sizeText.match(/\d+/g)?.map(Number) || [])
    .filter((n) => n > 0 && (n < 1900 || n > 2100));

  if (numbers.length === 0) return 40;

  const estimatedSize = Math.max(...numbers);
  if (estimatedSize >= icp.company_size_min && estimatedSize <= icp.company_size_max) return 100;
  if (estimatedSize < icp.company_size_min * 0.5 || estimatedSize > icp.company_size_max * 2) return 20;
  return 60;
}

function calcHiringSignal(enrichment: EnrichmentData): number {
  const count = enrichment.hiring_signals.length;
  if (count === 0) return 0;
  if (count >= 5) return 100;
  return Math.min(100, count * 25);
}

function calcContactability(enrichment: EnrichmentData): number {
  let score = 0;
  const verifiedEmails = enrichment.emails.filter((e) => e.mx_valid === true);
  if (verifiedEmails.length > 0) score += 60;
  else if (enrichment.emails.length > 0) score += 30;
  if (enrichment.phones.length > 0) score += 40;
  return Math.min(100, score);
}

function calcDataCompleteness(enrichment: EnrichmentData): number {
  let filled = 0;
  const total = 6;
  if (enrichment.summary && enrichment.summary !== "unknown") filled++;
  if (enrichment.size_signals.length > 0) filled++;
  if (enrichment.emails.length > 0) filled++;
  if (enrichment.phones.length > 0) filled++;
  if (enrichment.hiring_signals.length > 0) filled++;
  if (enrichment.keyword_matches.length > 0) filled++;
  return Math.round((filled / total) * 100);
}

function calcCompleteness(enrichment: EnrichmentData): number {
  let filled = 0;
  const total = 7;
  if (enrichment.summary && enrichment.summary !== "unknown") filled++;
  if (enrichment.size_signals.length > 0) filled++;
  if (enrichment.emails.length > 0) filled++;
  if (enrichment.phones.length > 0) filled++;
  if (enrichment.hiring_signals.length > 0) filled++;
  if (enrichment.keyword_matches.length > 0) filled++;
  if (enrichment.source_urls.length > 0) filled++;
  return Math.round((filled / total) * 100);
}
