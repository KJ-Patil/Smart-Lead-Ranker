import * as cheerio from "cheerio";
import type { EnrichmentData, ExtractedContact, ICPProfile } from "./types";
import { validateEmail, sleep } from "./utils";
import { apiEnrich } from "./api-enrichment";

const PAGES_TO_FETCH = ["", "/about", "/about-us", "/contact", "/careers", "/jobs"];
const FETCH_TIMEOUT = 8000;
const MAX_RETRIES = 2;
const USER_AGENT = "Mozilla/5.0 (compatible; SmartLeadRanker/1.0; +https://github.com/smart-lead-ranker)";

const domainLastFetch = new Map<string, number>();
const DOMAIN_RATE_LIMIT_MS = 2000;

const robotsCache = new Map<string, Set<string>>();

async function checkRobotsTxt(domain: string): Promise<Set<string>> {
  if (robotsCache.has(domain)) return robotsCache.get(domain)!;

  const disallowed = new Set<string>();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      let applies = false;
      for (const line of text.split("\n")) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed.startsWith("user-agent:")) {
          const agent = trimmed.slice("user-agent:".length).trim();
          applies = agent === "*" || agent.includes("smartleadranker");
        } else if (applies && trimmed.startsWith("disallow:")) {
          const path = trimmed.slice("disallow:".length).trim();
          if (path) disallowed.add(path);
        }
      }
    }
  } catch { /* robots.txt not available — allow all */ }

  robotsCache.set(domain, disallowed);
  return disallowed;
}

function isPathAllowed(path: string, disallowed: Set<string>): boolean {
  for (const rule of disallowed) {
    if (path.startsWith(rule)) return false;
  }
  return true;
}

async function enforceDomainRateLimit(domain: string) {
  const last = domainLastFetch.get(domain);
  if (last) {
    const elapsed = Date.now() - last;
    if (elapsed < DOMAIN_RATE_LIMIT_MS) {
      await sleep(DOMAIN_RATE_LIMIT_MS - elapsed);
    }
  }
  domainLastFetch.set(domain, Date.now());
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<{ html: string | null; blocked: boolean }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (res.status === 403 || res.status === 429 || res.status === 503) {
        return { html: null, blocked: true };
      }

      if (!res.ok) return { html: null, blocked: false };

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return { html: null, blocked: false };

      const html = await res.text();

      const lower = html.toLowerCase();
      const isCaptchaChallenge =
        lower.includes("cf-challenge-running") ||
        lower.includes("cf-challenge-form") ||
        lower.includes('id="challenge-form"') ||
        lower.includes("g-recaptcha") ||
        lower.includes("h-captcha") ||
        (lower.includes("recaptcha") && lower.includes("challenge")) ||
        (lower.includes("hcaptcha") && lower.includes("challenge"));
      if (isCaptchaChallenge) {
        return { html: null, blocked: true };
      }

      return { html, blocked: false };
    } catch {
      if (attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return { html: null, blocked: false };
    }
  }
  return { html: null, blocked: false };
}

export async function checkMX(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Answer && data.Answer.length > 0) return true;
    if (data.Status === 0 && (!data.Answer || data.Answer.length === 0)) return false;
    return null;
  } catch {
    return null;
  }
}

const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|css|js|woff2?|ttf|eot|map|json|xml)$/i;
const JUNK_PREFIX = /@\d+x\b|@(example|test|localhost|sentry|webpack|users\.noreply)\./i;
const NOREPLY = /^(noreply|no-reply|mailer-daemon|postmaster|donotreply|unsubscribe|bounce)@/i;
const VALID_EMAIL_TLD = /\.(com|org|net|io|co|us|uk|ca|au|de|fr|in|app|dev|ai|edu|gov|tech|biz|info)$/i;

function getCleanText($: cheerio.CheerioAPI): string {
  const clone = $.root().clone();
  clone.find("script, style, noscript, svg, code, pre").remove();
  return clone.find("body").text();
}

function extractEmails($: cheerio.CheerioAPI, sourceUrl: string, domain: string): ExtractedContact[] {
  const emails = new Set<string>();
  const coreDomain = domain.replace(/^www\./, "").split(".")[0].toLowerCase();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const raw = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (raw && raw.includes("@")) emails.add(raw.toLowerCase());
  });

  const cleanText = getCleanText($);
  const emailRegex = /[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const fromText = cleanText.match(emailRegex) || [];
  for (const e of fromText) emails.add(e.toLowerCase());

  return [...emails]
    .filter(validateEmail)
    .filter((e) => !JUNK_EMAIL.test(e) && !JUNK_PREFIX.test(e) && !NOREPLY.test(e))
    .filter((e) => VALID_EMAIL_TLD.test(e))
    .filter((e) => {
      const emailDom = e.split("@")[1].toLowerCase();
      return emailDom.includes(coreDomain);
    })
    .slice(0, 10)
    .map((email) => ({ email, mx_valid: null, source_url: sourceUrl }));
}

function extractPhones($: cheerio.CheerioAPI): string[] {
  const phones = new Set<string>();

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = href.replace(/^tel:\s*/i, "").replace(/[^\d+\-() .]/g, "").trim();
    const digits = num.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) phones.add(num);
  });

  const contactAreas = $(
    "footer, .footer, .contact, #contact, [class*='contact'], [class*='phone'], [class*='tel'], [itemtype*='PostalAddress']"
  );
  contactAreas.find("script, style").remove();
  const contactText = contactAreas.text();
  const phoneRegex = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)[-.\s]\d{3}[-.\s]\d{4}/g;
  const found = contactText.match(phoneRegex) || [];
  for (const p of found) {
    const digits = p.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) phones.add(p.trim());
  }

  return [...phones].slice(0, 5);
}

function extractSummary($: cheerio.CheerioAPI): string {
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc && metaDesc.length > 20) return metaDesc.slice(0, 300);

  const ogDesc = $('meta[property="og:description"]').attr("content");
  if (ogDesc && ogDesc.length > 20) return ogDesc.slice(0, 300);

  const firstP = $("main p, article p, .about p, #about p, body p").first().text().trim();
  if (firstP.length > 20) return firstP.slice(0, 300);

  return "unknown";
}

const NOT_EMPLOYEE_CONTEXT = /customers?|users?|clients?|downloads?|installs?|countries|cities|integrations?|products?|reviews?|ratings?/i;

function extractSizeSignals($: cheerio.CheerioAPI): string[] {
  const text = $("body").text();
  const lower = text.toLowerCase();
  const signals: string[] = [];

  const employeePatterns = [
    /(\d[\d,]*)\s*(?:\+\s*)?employees/gi,
    /team\s*of\s*(\d[\d,]*)/gi,
    /(\d[\d,]*)\s*(?:\+\s*)?team\s*members/gi,
    /(\d[\d,]*)\s*(?:\+\s*)?(?:staff|people\s+work)/gi,
  ];

  for (const pattern of employeePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const surrounding = text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40);
      if (!NOT_EMPLOYEE_CONTEXT.test(surrounding)) {
        signals.push(match[0].trim());
      }
    }
  }

  const aboutSection = $(".about, #about, [class*='about'], main").text().toLowerCase();
  const sizeContext = aboutSection || lower;

  if (sizeContext.includes("fortune 500")) signals.push("Fortune 500");
  if (sizeContext.includes("fortune 1000")) signals.push("Fortune 1000");

  if (/publicly\s+traded|nasdaq|nyse/i.test(sizeContext)) signals.push("Publicly traded");

  const seriesMatch = sizeContext.match(/series\s+[a-f]/i);
  if (seriesMatch) signals.push(seriesMatch[0]);

  if (signals.length === 0 && /enterprise/i.test(sizeContext)) {
    signals.push("Enterprise-level");
  }

  return [...new Set(signals)].slice(0, 5);
}

function extractHiringSignals($: cheerio.CheerioAPI, url: string): string[] {
  const signals: string[] = [];
  const text = $("body").text().toLowerCase();

  if (url.includes("/careers") || url.includes("/jobs")) {
    const jobLinks = $("a").filter((_, el) => {
      const href = $(el).attr("href") || "";
      const linkText = $(el).text().trim();
      if (linkText.length < 5 || linkText.length > 120) return false;
      const lower = linkText.toLowerCase();
      const isJobLink =
        (href.includes("/job") || href.includes("/position") || href.includes("/opening") || href.includes("apply")) &&
        !href.includes("/blog") && !href.includes("/article");
      const hasJobText =
        lower.includes("apply") || lower.includes("opening") ||
        (lower.includes("engineer") || lower.includes("manager") || lower.includes("designer") ||
         lower.includes("analyst") || lower.includes("director") || lower.includes("developer") ||
         lower.includes("specialist") || lower.includes("coordinator") || lower.includes("lead"));
      return isJobLink || hasJobText;
    });
    if (jobLinks.length > 3) {
      signals.push(`${jobLinks.length} job listings found`);
    } else if (jobLinks.length > 0) {
      signals.push(`${jobLinks.length} job listing(s) found`);
    }
  }

  if (/we.re\s+hiring|join\s+our\s+team|open\s+positions|career\s+opportunities|view\s+open\s+roles/i.test(text)) {
    signals.push("Active hiring language detected");
  }

  const roleCount = (text.match(/\b(engineer|developer|designer|manager|analyst|director)\b/gi) || []).length;
  if (roleCount >= 5 && (url.includes("/careers") || url.includes("/jobs"))) {
    signals.push(`${roleCount} role-related mentions on careers page`);
  }

  return [...new Set(signals)].slice(0, 5);
}

function findKeywordMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => {
    const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
  });
}

export async function enrichCompany(
  domain: string,
  icp: ICPProfile
): Promise<EnrichmentData & { needs_review?: boolean }> {
  const baseUrl = `https://${domain}`;
  const allEmails: ExtractedContact[] = [];
  const allPhones: string[] = [];
  const allSizeSignals: string[] = [];
  const allHiringSignals: string[] = [];
  const allText: string[] = [];
  const sourceUrls: string[] = [];
  let summary = "unknown";
  let wasBlocked = false;

  const apiData = await apiEnrich(domain);

  if (apiData) {
    if (apiData.summary) summary = apiData.summary;
    if (apiData.size_signals) allSizeSignals.push(...apiData.size_signals);
    if (apiData.emails) allEmails.push(...apiData.emails);
    if (apiData.phones) allPhones.push(...apiData.phones);
  }

  const disallowed = await checkRobotsTxt(domain);

  for (const path of PAGES_TO_FETCH) {
    const fullPath = path || "/";
    if (!isPathAllowed(fullPath, disallowed)) continue;

    await enforceDomainRateLimit(domain);

    const url = baseUrl + path;
    const { html, blocked } = await fetchWithRetry(url);

    if (blocked) {
      wasBlocked = true;
      continue;
    }

    if (html) {
      sourceUrls.push(url);
      const $ = cheerio.load(html);

      if (summary === "unknown") {
        summary = extractSummary($);
      }

      allEmails.push(...extractEmails($, url, domain));
      allPhones.push(...extractPhones($));
      allSizeSignals.push(...extractSizeSignals($));
      allHiringSignals.push(...extractHiringSignals($, url));
      allText.push($("body").text().slice(0, 5000));
    }
  }

  const uniqueEmails = allEmails.filter(
    (e, i, arr) => arr.findIndex((x) => x.email === e.email) === i
  );

  for (const contact of uniqueEmails) {
    if (contact.mx_valid !== null) continue;
    const emailDomain = contact.email.split("@")[1];
    if (emailDomain) {
      contact.mx_valid = await checkMX(emailDomain);
    }
  }

  const keywordMatches = findKeywordMatches(
    allText.join(" "),
    icp.industry_keywords
  );

  return {
    summary,
    size_signals: [...new Set(allSizeSignals)].slice(0, 5),
    emails: uniqueEmails.slice(0, 10),
    phones: [...new Set(allPhones)].slice(0, 5),
    hiring_signals: [...new Set(allHiringSignals)].slice(0, 5),
    keyword_matches: keywordMatches,
    source_urls: sourceUrls,
    fetched_at: new Date().toISOString(),
    needs_review: wasBlocked || undefined,
  };
}
