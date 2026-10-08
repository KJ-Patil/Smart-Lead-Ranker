export interface ICPProfile {
  id: string;
  name: string;
  industry_keywords: string[];
  company_size_min: number;
  company_size_max: number;
  region: string;
  target_roles: string[];
  created_at: string;
}

export interface Lead {
  id: string;
  icp_id: string;
  company_name: string;
  website: string;
  domain: string;
  contact_name?: string;
  contact_email?: string;
  status: "new" | "good" | "bad" | "contacted" | "needs_review";
  score: number;
  score_breakdown: ScoreBreakdown;
  data_quality: "high" | "medium" | "low";
  completeness: number;
  enrichment?: EnrichmentData;
  llm_reason?: string;
  outreach_angle?: string;
  created_at: string;
}

export interface ScoreBreakdown {
  icp_match: number;
  size_fit: number;
  hiring_signal: number;
  contactability: number;
  data_completeness: number;
}

export interface EnrichmentData {
  summary: string;
  size_signals: string[];
  emails: ExtractedContact[];
  phones: string[];
  hiring_signals: string[];
  keyword_matches: string[];
  source_urls: string[];
  fetched_at: string;
}

export interface ExtractedContact {
  email: string;
  mx_valid: boolean | null;
  source_url: string;
}

export interface Job {
  id: string;
  icp_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_leads: number;
  processed_leads: number;
  created_at: string;
  updated_at: string;
}

export interface LLMResponse {
  score_reason: string;
  outreach_angle: string;
  confidence: number;
  evidence_urls: string[];
}

export interface CSVRow {
  company_name: string;
  website: string;
  contact_name?: string;
  contact_email?: string;
}
