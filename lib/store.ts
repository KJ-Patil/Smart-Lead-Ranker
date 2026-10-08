import type { ICPProfile, Lead, Job } from "./types";
import { getSupabase } from "./supabase";

const useSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

// ── In-memory fallback ──

const memICP = new Map<string, ICPProfile>();
const memLeads = new Map<string, Lead>();
const memJobs = new Map<string, Job>();
const memCache = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// ── Store interface (Supabase-first, in-memory fallback) ──

export const store = {
  icp: {
    getAll: async (): Promise<ICPProfile[]> => {
      if (!useSupabase) return [...memICP.values()];
      const { data } = await getSupabase().from("icp_profiles").select("*").order("created_at", { ascending: false });
      return (data as ICPProfile[]) || [];
    },
    get: async (id: string): Promise<ICPProfile | null> => {
      if (!useSupabase) return memICP.get(id) || null;
      const { data } = await getSupabase().from("icp_profiles").select("*").eq("id", id).single();
      return data as ICPProfile | null;
    },
    set: async (profile: ICPProfile): Promise<void> => {
      if (!useSupabase) { memICP.set(profile.id, profile); return; }
      await getSupabase().from("icp_profiles").upsert(profile);
    },
    delete: async (id: string): Promise<void> => {
      if (!useSupabase) { memICP.delete(id); return; }
      await getSupabase().from("icp_profiles").delete().eq("id", id);
    },
  },

  leads: {
    getAll: async (): Promise<Lead[]> => {
      if (!useSupabase) return [...memLeads.values()];
      const { data } = await getSupabase().from("leads").select("*").order("score", { ascending: false });
      return (data as Lead[]) || [];
    },
    getByICP: async (icpId: string): Promise<Lead[]> => {
      if (!useSupabase) return [...memLeads.values()].filter((l) => l.icp_id === icpId);
      const { data } = await getSupabase().from("leads").select("*").eq("icp_id", icpId).order("score", { ascending: false });
      return (data as Lead[]) || [];
    },
    get: async (id: string): Promise<Lead | null> => {
      if (!useSupabase) return memLeads.get(id) || null;
      const { data } = await getSupabase().from("leads").select("*").eq("id", id).single();
      return data as Lead | null;
    },
    set: async (lead: Lead): Promise<void> => {
      if (!useSupabase) { memLeads.set(lead.id, lead); return; }
      await getSupabase().from("leads").upsert(lead);
    },
    delete: async (id: string): Promise<void> => {
      if (!useSupabase) { memLeads.delete(id); return; }
      await getSupabase().from("leads").delete().eq("id", id);
    },
    deleteByICP: async (icpId: string): Promise<void> => {
      if (!useSupabase) {
        for (const [id, lead] of memLeads) {
          if (lead.icp_id === icpId) memLeads.delete(id);
        }
        return;
      }
      await getSupabase().from("leads").delete().eq("icp_id", icpId);
    },
  },

  jobs: {
    getAll: async (): Promise<Job[]> => {
      if (!useSupabase) return [...memJobs.values()];
      const { data } = await getSupabase().from("jobs").select("*").order("created_at", { ascending: false });
      return (data as Job[]) || [];
    },
    get: async (id: string): Promise<Job | null> => {
      if (!useSupabase) return memJobs.get(id) || null;
      const { data } = await getSupabase().from("jobs").select("*").eq("id", id).single();
      return data as Job | null;
    },
    set: async (job: Job): Promise<void> => {
      if (!useSupabase) { memJobs.set(job.id, job); return; }
      await getSupabase().from("jobs").upsert(job);
    },
  },

  cache: {
    get: async (domain: string): Promise<unknown | null> => {
      if (!useSupabase) {
        const entry = memCache.get(domain);
        if (!entry) return null;
        if (Date.now() - entry.fetchedAt > CACHE_TTL) { memCache.delete(domain); return null; }
        return entry.data;
      }
      const cutoff = new Date(Date.now() - CACHE_TTL).toISOString();
      const { data } = await getSupabase()
        .from("enrichment_cache")
        .select("*")
        .eq("domain", domain)
        .gte("fetched_at", cutoff)
        .single();
      return data?.data || null;
    },
    set: async (domain: string, cacheData: unknown): Promise<void> => {
      if (!useSupabase) { memCache.set(domain, { data: cacheData, fetchedAt: Date.now() }); return; }
      await getSupabase().from("enrichment_cache").upsert({
        domain,
        data: cacheData,
        fetched_at: new Date().toISOString(),
      });
    },
    clearAll: async (): Promise<void> => {
      if (!useSupabase) { memCache.clear(); return; }
      await getSupabase().from("enrichment_cache").delete().neq("domain", "");
    },
  },
};
