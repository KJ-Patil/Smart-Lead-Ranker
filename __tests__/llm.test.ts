import { describe, it, expect } from "vitest";
import { z } from "zod";

const LLMResponseSchema = z.object({
  score_reason: z.string(),
  outreach_angle: z.string(),
  confidence: z.number().min(0).max(1),
  evidence_urls: z.array(z.string()),
});

describe("LLM JSON validation", () => {
  it("validates correct response", () => {
    const valid = {
      score_reason: "Strong match",
      outreach_angle: "Pitch growth tools",
      confidence: 0.8,
      evidence_urls: ["https://example.com"],
    };
    expect(LLMResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing fields", () => {
    const invalid = {
      score_reason: "Test",
    };
    expect(LLMResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const invalid = {
      score_reason: "Test",
      outreach_angle: "Test",
      confidence: 1.5,
      evidence_urls: [],
    };
    expect(LLMResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects wrong types", () => {
    const invalid = {
      score_reason: 123,
      outreach_angle: "Test",
      confidence: 0.5,
      evidence_urls: "not-array",
    };
    expect(LLMResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts empty evidence_urls", () => {
    const valid = {
      score_reason: "Limited data",
      outreach_angle: "Generic intro",
      confidence: 0.3,
      evidence_urls: [],
    };
    expect(LLMResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts confidence at boundaries", () => {
    const zero = { score_reason: "x", outreach_angle: "y", confidence: 0, evidence_urls: [] };
    const one = { score_reason: "x", outreach_angle: "y", confidence: 1, evidence_urls: [] };
    expect(LLMResponseSchema.safeParse(zero).success).toBe(true);
    expect(LLMResponseSchema.safeParse(one).success).toBe(true);
  });
});
