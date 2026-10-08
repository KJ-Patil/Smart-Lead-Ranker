"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Download, FileText, Database, Zap, Shield, Moon, Sun, Trash2,
  Upload, Target, BarChart3, AlertTriangle,
} from "lucide-react";
import type { ICPProfile, Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Stepper } from "@/components/stepper";
import { ICPForm } from "@/components/icp-form";
import { CSVUpload } from "@/components/csv-upload";
import { LeadTable } from "@/components/lead-table";
import { LeadDrawer } from "@/components/lead-drawer";
import { ProgressBar } from "@/components/progress-bar";

export default function Home() {
  const [step, setStep] = useState(0);
  const [icp, setICP] = useState<ICPProfile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ uploaded: number; deduplicated: number } | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleICPSave = (profile: ICPProfile) => {
    setICP(profile);
    setStep(1);
  };

  const handleUpload = (result: { uploaded: number; deduplicated: number }) => {
    setUploadStats(result);
    fetchLeads();
  };

  const fetchLeads = useCallback(async () => {
    if (!icp) return;
    setLoading(true);
    const res = await fetch(`/api/leads?icp_id=${icp.id}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data);
    }
    setLoading(false);
  }, [icp]);

  const startEnrichment = async () => {
    if (!icp) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp_id: icp.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobId(data.job_id);
        setStep(2);
      } else {
        const data = await res.json();
        if (data.error === "No leads to enrich") {
          await fetchLeads();
          setStep(2);
        }
        setEnriching(false);
      }
    } catch {
      setEnriching(false);
    }
  };

  const handleEnrichComplete = useCallback(() => {
    setEnriching(false);
    setJobId(null);
    fetchLeads();
  }, [fetchLeads]);

  const handleStatusChange = async (id: string, status: Lead["status"]) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      if (selectedLead?.id === id) {
        setSelectedLead({ ...selectedLead, status });
      }
    }
  };

  const handleDeleteLead = async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selectedLead?.id === id) setSelectedLead(null);
    }
  };

  const exportLeads = (format: string) => {
    if (!icp) return;
    window.open(`/api/export?icp_id=${icp.id}&format=${format}`, "_blank");
  };

  const hasEnrichedLeads = leads.some((l) => l.enrichment);
  const needsReviewCount = leads.filter((l) => l.status === "needs_review").length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="clay-header border-b">
        <div className="mx-auto max-w-[1440px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground clay-btn">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Smart Lead Ranker</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">AI-powered lead scoring & enrichment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasEnrichedLeads && (
              <>
                <button
                  onClick={() => exportLeads("csv")}
                  className="clay-btn flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={() => exportLeads("hubspot")}
                  className="clay-btn flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Database className="h-3.5 w-3.5" /> HubSpot
                </button>
                <button
                  onClick={() => exportLeads("summary")}
                  className="clay-btn flex items-center gap-1.5 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <FileText className="h-3.5 w-3.5" /> Report
                </button>
                <div className="w-px h-6 bg-border mx-1" />
              </>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="clay-btn border p-1.5 hover:bg-accent transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b bg-card/50">
        <div className="mx-auto max-w-[1440px] px-4 py-3">
          <Stepper
            currentStep={step}
            completedSteps={icp ? [0] : []}
            onStepClick={(s) => {
              if (s === 0) setStep(0);
              if (s === 1 && icp) setStep(1);
              if (s === 2 && icp && leads.length > 0) setStep(2);
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {/* Step 0: Define Target (centered) */}
        {step === 0 && (
          <div className="mx-auto max-w-xl px-4 py-4">
            <div className="clay-card p-5">
              <ICPForm onSave={handleICPSave} existingProfile={icp} />
            </div>
          </div>
        )}

        {/* Step 1: Upload Leads (centered) */}
        {step === 1 && icp && (
          <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
            <div className="clay-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Target: {icp.name}</h3>
                <button onClick={() => setStep(0)} className="text-xs text-primary hover:underline">Edit</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {icp.industry_keywords.map((kw) => (
                  <span key={kw} className="clay-tag bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">{kw}</span>
                ))}
                <span className="clay-tag bg-secondary px-2 py-0.5 text-xs">{icp.company_size_min}-{icp.company_size_max} employees</span>
                <span className="clay-tag bg-secondary px-2 py-0.5 text-xs">{icp.region}</span>
              </div>
            </div>

            <div className="clay-card p-4">
              <CSVUpload icpId={icp.id} onUpload={handleUpload} />
            </div>

            {uploadStats && (
              <div className="clay-card bg-emerald-50 dark:bg-emerald-950/70 p-3 !border-emerald-200 dark:!border-emerald-800">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Uploaded {uploadStats.uploaded} leads, {uploadStats.deduplicated} unique after deduplication.
                </p>
                <button
                  onClick={startEnrichment}
                  disabled={enriching}
                  className={cn(
                    "clay-btn mt-3 w-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
                    "hover:opacity-90 disabled:opacity-50 transition-opacity"
                  )}
                >
                  {enriching ? "Starting..." : "Enrich & Score All Leads"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 3-Panel Dashboard */}
        {step === 2 && (
          <div className="flex h-[calc(100vh-140px)]">
            {/* LEFT PANEL: ICP & Filters */}
            <aside className="w-72 clay-sidebar border-r overflow-y-auto shrink-0 hidden lg:block">
              <div className="p-4 space-y-5">
                {/* ICP Summary */}
                {icp && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Target Profile</h3>
                    </div>
                    <div className="clay-stat p-3 space-y-2">
                      <p className="text-sm font-medium">{icp.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {icp.industry_keywords.map((kw) => (
                          <span key={kw} className="clay-tag bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-medium">{kw}</span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{icp.company_size_min}-{icp.company_size_max} employees</p>
                      <p className="text-xs text-muted-foreground">{icp.region}</p>
                      {icp.target_roles.length > 0 && (
                        <p className="text-xs text-muted-foreground">Roles: {icp.target_roles.join(", ")}</p>
                      )}
                      <button onClick={() => setStep(0)} className="text-xs text-primary hover:underline">Edit profile</button>
                    </div>
                  </div>
                )}

                {/* Stats */}
                {leads.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Summary</h3>
                    </div>
                    <div className="space-y-2">
                      <StatRow label="Total Leads" value={leads.length} />
                      <StatRow label="High Priority" value={leads.filter((l) => l.score >= 70).length} color="text-emerald-600" />
                      <StatRow label="Medium" value={leads.filter((l) => l.score >= 40 && l.score < 70).length} color="text-amber-600" />
                      <StatRow label="Low" value={leads.filter((l) => l.score < 40 && l.score > 0).length} color="text-red-500" />
                      <StatRow label="With Email" value={leads.filter((l) => (l.enrichment?.emails?.length ?? 0) > 0).length} />
                      <StatRow label="Hiring" value={leads.filter((l) => (l.enrichment?.hiring_signals?.length ?? 0) > 0).length} />
                      {needsReviewCount > 0 && (
                        <StatRow label="Needs Review" value={needsReviewCount} color="text-amber-600" />
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Upload className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Actions</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => setStep(1)}
                      className="clay-btn w-full border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors text-left"
                    >
                      Upload more leads
                    </button>
                    {leads.some((l) => !l.enrichment) && (
                      <button
                        onClick={startEnrichment}
                        disabled={enriching}
                        className={cn(
                          "clay-btn w-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground",
                          "hover:opacity-90 disabled:opacity-50 transition-opacity text-left"
                        )}
                      >
                        {enriching ? "Enriching..." : "Enrich unenriched leads"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* CENTER: Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Needs Review Banner */}
              {needsReviewCount > 0 && (
                <div className="clay-card mb-4 bg-amber-50 dark:bg-amber-950/70 !border-amber-200 dark:!border-amber-800 p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {needsReviewCount} lead{needsReviewCount > 1 ? "s" : ""} blocked by CAPTCHA or rate limiting — marked as &quot;needs manual review&quot;.
                  </p>
                </div>
              )}

              {/* Progress */}
              {jobId && (
                <div className="mb-4">
                  <ProgressBar jobId={jobId} onComplete={handleEnrichComplete} />
                </div>
              )}

              {/* Skeleton Loader */}
              {loading && leads.length === 0 && (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="clay-card p-4 animate-pulse">
                      <div className="flex gap-4">
                        <div className="h-4 w-32 bg-secondary rounded" />
                        <div className="h-4 w-16 bg-secondary rounded" />
                        <div className="h-4 w-20 bg-secondary rounded" />
                        <div className="flex-1" />
                        <div className="h-4 w-24 bg-secondary rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Table */}
              {leads.length > 0 && !loading && (
                <LeadTable
                  leads={leads}
                  onSelectLead={setSelectedLead}
                  onStatusChange={handleStatusChange}
                  onDeleteLead={handleDeleteLead}
                  selectedLeadId={selectedLead?.id}
                />
              )}

              {/* Empty State */}
              {leads.length === 0 && !jobId && !loading && (
                <div className="text-center py-16">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Upload a CSV or load sample data to get started.</p>
                  <button onClick={() => setStep(1)} className="clay-btn bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Go to Upload
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: Detail Drawer (inline, not overlay on desktop) */}
            {selectedLead && (
              <aside className="w-96 border-l clay-sidebar overflow-y-auto shrink-0 hidden xl:block">
                <LeadDrawer
                  lead={selectedLead}
                  onClose={() => setSelectedLead(null)}
                  onDelete={() => handleDeleteLead(selectedLead.id)}
                  inline
                />
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-3">
        <div className="mx-auto max-w-[1440px] px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span>Only publicly available business information is collected. No login-walled data. Respects robots.txt.</span>
          </div>
          <span>Smart Lead Ranker</span>
        </div>
      </footer>

      {/* Mobile overlay drawer (shows on smaller screens) */}
      {selectedLead && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 xl:hidden" onClick={() => setSelectedLead(null)} />
          <div className="xl:hidden z-50 relative">
            <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onDelete={() => handleDeleteLead(selectedLead.id)} />
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="clay-stat flex items-center justify-between px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}
