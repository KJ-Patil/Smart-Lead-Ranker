import { describe, it, expect } from "vitest";
import { scoreLead } from "@/lib/scoring";
import type { EnrichmentData, ICPProfile } from "@/lib/types";

const baseICP: ICPProfile = {
  id: "test-icp",
  name: "Test",
  industry_keywords: ["saas", "cloud", "api"],
  company_size_min: 50,
  company_size_max: 500,
  region: "North America",
  target_roles: ["CTO"],
  created_at: new Date().toISOString(),
};

function makeEnrichment(overrides: Partial<EnrichmentData> = {}): EnrichmentData {
  return {
    summary: "A cloud SaaS company",
    size_signals: [],
    emails: [],
    phones: [],
    hiring_signals: [],
    keyword_matches: [],
    source_urls: ["https://example.com"],
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("scoreLead", () => {
  it("returns 0-100 score", () => {
    const result = scoreLead(makeEnrichment(), baseICP);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("scores higher with keyword matches", () => {
    const low = scoreLead(makeEnrichment({ keyword_matches: [] }), baseICP);
    const high = scoreLead(makeEnrichment({ keyword_matches: ["saas", "cloud", "api"] }), baseICP);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("scores higher with hiring signals", () => {
    const noHiring = scoreLead(makeEnrichment({ hiring_signals: [] }), baseICP);
    const hiring = scoreLead(makeEnrichment({ hiring_signals: ["3 job listings", "Active hiring"] }), baseICP);
    expect(hiring.score).toBeGreaterThan(noHiring.score);
  });

  it("scores higher with email contacts", () => {
    const noEmail = scoreLead(makeEnrichment({ emails: [] }), baseICP);
    const withEmail = scoreLead(
      makeEnrichment({
        emails: [{ email: "test@example.com", mx_valid: true, source_url: "https://example.com" }],
      }),
      baseICP
    );
    expect(withEmail.score).toBeGreaterThan(noEmail.score);
  });

  it("returns valid breakdown fields", () => {
    const result = scoreLead(makeEnrichment(), baseICP);
    expect(result.breakdown).toHaveProperty("icp_match");
    expect(result.breakdown).toHaveProperty("size_fit");
    expect(result.breakdown).toHaveProperty("hiring_signal");
    expect(result.breakdown).toHaveProperty("contactability");
    expect(result.breakdown).toHaveProperty("data_completeness");
  });

  it("returns quality label", () => {
    const result = scoreLead(makeEnrichment(), baseICP);
    expect(["high", "medium", "low"]).toContain(result.quality);
  });

  it("returns completeness 0-100", () => {
    const result = scoreLead(makeEnrichment(), baseICP);
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeLessThanOrEqual(100);
  });
});
