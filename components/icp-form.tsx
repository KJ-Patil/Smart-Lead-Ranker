"use client";

import { useState } from "react";
import { Target, Plus, X } from "lucide-react";
import type { ICPProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ICPFormProps {
  onSave: (profile: ICPProfile) => void;
  existingProfile?: ICPProfile | null;
}

export function ICPForm({ onSave, existingProfile }: ICPFormProps) {
  const [name, setName] = useState(existingProfile?.name || "");
  const [keywords, setKeywords] = useState<string[]>(existingProfile?.industry_keywords || []);
  const [keywordInput, setKeywordInput] = useState("");
  const [sizeMin, setSizeMin] = useState(existingProfile?.company_size_min?.toString() ?? "");
  const [sizeMax, setSizeMax] = useState(existingProfile?.company_size_max?.toString() ?? "");
  const [region, setRegion] = useState(existingProfile?.region || "");
  const [roles, setRoles] = useState<string[]>(existingProfile?.target_roles || []);
  const [roleInput, setRoleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const addRole = () => {
    const r = roleInput.trim();
    if (r && !roles.some((x) => x.toLowerCase() === r.toLowerCase())) {
      setRoles([...roles, r]);
      setRoleInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || keywords.length === 0 || !region.trim()) {
      setError("Please fill in name, at least one keyword, and region.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry_keywords: keywords,
          company_size_min: sizeMin === "" ? 0 : Number(sizeMin),
          company_size_max: sizeMax === "" ? 0 : Number(sizeMax),
          region: region.trim(),
          target_roles: roles,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      const profile = await res.json();
      onSave(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Define Your Target Customer</h2>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Profile Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='e.g. "B2B SaaS in North America"'
          className="clay-input w-full px-3 py-1.5 text-sm focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Industry Keywords</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
            placeholder="e.g. SaaS, fintech, healthcare"
            className="clay-input flex-1 px-3 py-1.5 text-sm focus:outline-none"
          />
          <button type="button" onClick={addKeyword} className="clay-btn bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {keywords.map((kw) => (
              <span key={kw} className="clay-tag inline-flex items-center gap-1 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {kw}
                <button type="button" onClick={() => setKeywords(keywords.filter((k) => k !== kw))} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Min Employees</label>
          <input
            type="number"
            value={sizeMin}
            onChange={(e) => setSizeMin(e.target.value)}
            min={0}
            className="clay-input w-full px-3 py-1.5 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Employees</label>
          <input
            type="number"
            value={sizeMax}
            onChange={(e) => setSizeMax(e.target.value)}
            min={0}
            className="clay-input w-full px-3 py-1.5 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Region</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. North America"
            className="clay-input w-full px-3 py-1.5 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Target Roles (optional)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())}
            placeholder="e.g. CTO, VP Sales, Head of Ops"
            className="clay-input flex-1 px-3 py-1.5 text-sm focus:outline-none"
          />
          <button type="button" onClick={addRole} className="clay-btn bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {roles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {roles.map((r) => (
              <span key={r} className="clay-tag inline-flex items-center gap-1 bg-secondary px-2.5 py-0.5 text-xs font-medium">
                {r}
                <button type="button" onClick={() => setRoles(roles.filter((x) => x !== r))} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "clay-btn w-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        )}
      >
        {loading ? "Saving..." : "Save Target Profile"}
      </button>
    </form>
  );
}
