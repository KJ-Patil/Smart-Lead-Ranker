import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeDomain(input: string): string {
  let url = input.trim().toLowerCase();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

export function deduplicateLeads<T extends { domain: string; company_name: string }>(
  leads: T[]
): T[] {
  const seen = new Map<string, T>();
  for (const lead of leads) {
    const key = lead.domain;
    if (!seen.has(key)) {
      const fuzzyKey = lead.company_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingByName = [...seen.values()].find(
        (l) => l.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") === fuzzyKey
      );
      if (!existingByName) {
        seen.set(key, lead);
      }
    }
  }
  return [...seen.values()];
}

export function validateEmail(email: string): boolean {
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return false;
  if (email.length > 254) return false;
  const [local, domainPart] = email.split("@");
  if (local.length > 64) return false;
  if (/^[._+-]|[._+-]$/.test(local)) return false;
  if (domainPart.split(".").some((p) => p.length > 63 || p.length === 0)) return false;
  return true;
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950";
  if (score >= 40) return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950";
  return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function getQualityColor(quality: string): string {
  if (quality === "high") return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950";
  if (quality === "medium") return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950";
  return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
