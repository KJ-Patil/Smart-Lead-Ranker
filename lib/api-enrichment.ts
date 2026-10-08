import type { EnrichmentData, ExtractedContact } from "./types";

interface ApolloOrg {
  name?: string;
  short_description?: string;
  estimated_num_employees?: number;
  industry?: string;
  keywords?: string[];
  phone?: string;
  founded_year?: number;
  linkedin_url?: string;
  primary_domain?: string;
}

interface ApolloContact {
  email?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  phone_numbers?: { raw_number: string }[];
  organization?: ApolloOrg;
}

export async function enrichWithApollo(
  domain: string
): Promise<{
  org: ApolloOrg | null;
  contacts: ApolloContact[];
} | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;

  try {
    const orgRes = await fetch(
      "https://api.apollo.io/api/v1/organizations/enrich",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
        },
        body: JSON.stringify({ domain }),
      }
    );

    let org: ApolloOrg | null = null;
    if (orgRes.ok) {
      const data = await orgRes.json();
      org = data.organization || null;
    }

    const peopleRes = await fetch(
      "https://api.apollo.io/api/v1/mixed_people/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
        },
        body: JSON.stringify({
          organization_domains: [domain],
          per_page: 5,
          person_seniorities: ["c_suite", "vp", "director", "manager"],
        }),
      }
    );

    let contacts: ApolloContact[] = [];
    if (peopleRes.ok) {
      const data = await peopleRes.json();
      contacts = data.people || [];
    }

    return { org, contacts };
  } catch {
    return null;
  }
}

export async function enrichWithHunter(
  domain: string
): Promise<{ emails: string[]; org_name?: string } | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}&limit=5`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const emails: string[] = (data.data?.emails || [])
      .map((e: { value?: string }) => e.value)
      .filter(Boolean);

    return {
      emails,
      org_name: data.data?.organization,
    };
  } catch {
    return null;
  }
}

export async function apiEnrich(
  domain: string
): Promise<Partial<EnrichmentData> | null> {
  const [apollo, hunter] = await Promise.all([
    enrichWithApollo(domain),
    enrichWithHunter(domain),
  ]);

  if (!apollo && !hunter) return null;

  const emails: ExtractedContact[] = [];
  const phones: string[] = [];
  const sizeSignals: string[] = [];
  let summary = "";

  if (apollo?.org) {
    const org = apollo.org;
    if (org.short_description) summary = org.short_description;
    if (org.estimated_num_employees) {
      sizeSignals.push(`${org.estimated_num_employees.toLocaleString()} employees`);
    }
    if (org.industry) sizeSignals.push(org.industry);
    if (org.phone) phones.push(org.phone);
  }

  if (apollo?.contacts) {
    for (const c of apollo.contacts) {
      if (c.email) {
        emails.push({
          email: c.email,
          mx_valid: true,
          source_url: `apollo.io (${c.first_name} ${c.last_name} — ${c.title || "N/A"})`,
        });
      }
      if (c.phone_numbers) {
        for (const p of c.phone_numbers) {
          if (p.raw_number && !phones.includes(p.raw_number)) {
            phones.push(p.raw_number);
          }
        }
      }
    }
  }

  if (hunter?.emails) {
    for (const email of hunter.emails) {
      if (!emails.find((e) => e.email === email)) {
        emails.push({
          email,
          mx_valid: true,
          source_url: "hunter.io",
        });
      }
    }
  }

  return {
    summary: summary || undefined,
    size_signals: sizeSignals.length > 0 ? sizeSignals : undefined,
    emails: emails.length > 0 ? emails : undefined,
    phones: phones.length > 0 ? phones : undefined,
  };
}
