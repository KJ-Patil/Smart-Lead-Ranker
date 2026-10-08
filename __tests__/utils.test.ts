import { describe, it, expect } from "vitest";
import { normalizeDomain, deduplicateLeads, validateEmail } from "@/lib/utils";

describe("normalizeDomain", () => {
  it("strips protocol and www", () => {
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
    expect(normalizeDomain("http://www.example.com")).toBe("example.com");
  });

  it("handles bare domain", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("strips path", () => {
    expect(normalizeDomain("https://example.com/about")).toBe("example.com");
  });

  it("lowercases", () => {
    expect(normalizeDomain("HTTPS://WWW.Example.COM")).toBe("example.com");
  });

  it("handles subdomain", () => {
    expect(normalizeDomain("https://app.example.com")).toBe("app.example.com");
  });
});

describe("deduplicateLeads", () => {
  it("removes duplicate domains", () => {
    const leads = [
      { domain: "example.com", company_name: "Example Inc" },
      { domain: "example.com", company_name: "Example" },
      { domain: "other.com", company_name: "Other" },
    ];
    const result = deduplicateLeads(leads);
    expect(result).toHaveLength(2);
    expect(result[0].domain).toBe("example.com");
    expect(result[1].domain).toBe("other.com");
  });

  it("removes fuzzy name matches with different domains", () => {
    const leads = [
      { domain: "stripe.com", company_name: "Stripe" },
      { domain: "stripe.io", company_name: "Stripe" },
      { domain: "shopify.com", company_name: "Shopify" },
    ];
    const result = deduplicateLeads(leads);
    expect(result).toHaveLength(2);
  });

  it("handles empty array", () => {
    expect(deduplicateLeads([])).toEqual([]);
  });

  it("keeps single lead", () => {
    const leads = [{ domain: "test.com", company_name: "Test" }];
    expect(deduplicateLeads(leads)).toHaveLength(1);
  });
});

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("name.last@company.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("notanemail")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });
});
