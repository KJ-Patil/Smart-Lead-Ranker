"use client";

import { X, ExternalLink, Mail, Phone, Briefcase, Shield, BarChart3, Trash2, AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/types";
import { cn, getScoreColor, getScoreLabel, getQualityColor } from "@/lib/utils";

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onDelete?: () => void;
  inline?: boolean;
}

export function LeadDrawer({ lead, onClose, onDelete, inline }: LeadDrawerProps) {
  if (!lead) return null;

  const breakdown = lead.score_breakdown;
  const enrichment = lead.enrichment;

  const scoreItems = [
    { label: "ICP Match", value: breakdown.icp_match },
    { label: "Size Fit", value: breakdown.size_fit },
    { label: "Hiring Signal", value: breakdown.hiring_signal },
    { label: "Contactability", value: breakdown.contactability },
    { label: "Data Completeness", value: breakdown.data_completeness },
  ];

  const wrapperClass = inline
    ? ""
    : "fixed inset-y-0 right-0 z-50 w-full max-w-md clay-sidebar border-l overflow-y-auto";

  return (
    <div className={wrapperClass}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <h3 className="text-lg font-semibold truncate">{lead.company_name}</h3>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button onClick={onDelete} className="rounded-lg p-1.5 hover:bg-red-100 dark:hover:bg-red-900" aria-label="Delete lead">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Needs Review Warning */}
        {lead.status === "needs_review" && (
          <div className="clay-card bg-amber-50 dark:bg-amber-950/70 !border-amber-200 dark:!border-amber-800 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Needs Manual Review</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">This site was blocked by CAPTCHA or rate limiting. Data may be incomplete.</p>
            </div>
          </div>
        )}

        {/* Score Header */}
        <div className="flex items-center gap-4">
          <div className={cn("clay-card flex h-16 w-16 items-center justify-center !rounded-2xl text-2xl font-bold", getScoreColor(lead.score))}>
            {lead.score}
          </div>
          <div>
            <div className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold mb-1", getScoreColor(lead.score))}>
              {getScoreLabel(lead.score)} Priority
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getQualityColor(lead.data_quality))}>
                {lead.data_quality} quality
              </span>
              <span className="text-xs text-muted-foreground">{lead.completeness}% complete</span>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Score Breakdown
          </h4>
          <div className="space-y-2">
            {scoreItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-xs w-32 text-muted-foreground">{item.label}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", item.value >= 70 ? "bg-emerald-500" : item.value >= 40 ? "bg-amber-500" : "bg-red-400")}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-8 text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* LLM Reason */}
        {lead.llm_reason && (
          <div className="clay-card bg-primary/5 !border-primary/20 p-3">
            <p className="text-sm font-medium mb-1">Why this lead</p>
            <p className="text-sm text-muted-foreground">{lead.llm_reason}</p>
            {lead.outreach_angle && (
              <>
                <p className="text-sm font-medium mt-3 mb-1">Outreach Angle</p>
                <p className="text-sm text-muted-foreground">{lead.outreach_angle}</p>
              </>
            )}
          </div>
        )}

        {/* Company Summary */}
        {enrichment && (
          <>
            <div>
              <h4 className="text-sm font-semibold mb-2">About</h4>
              <p className="text-sm text-muted-foreground">
                {enrichment.summary !== "unknown" ? enrichment.summary : "No description available"}
              </p>
              <a
                href={`https://${lead.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
              >
                {lead.domain} <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Contacts */}
            {enrichment.emails.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> Emails
                </h4>
                <ul className="space-y-1.5">
                  {enrichment.emails.map((e) => (
                    <li key={e.email} className="flex items-center gap-2 text-sm">
                      <span className="truncate">{e.email}</span>
                      {e.mx_valid === true && (
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                          MX Valid
                        </span>
                      )}
                      {e.mx_valid === false && (
                        <span className="rounded bg-red-50 dark:bg-red-950 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-400 font-medium shrink-0">
                          MX Invalid
                        </span>
                      )}
                      <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  MX check confirms the domain can receive mail, not that a specific mailbox exists.
                </p>
              </div>
            )}

            {enrichment.phones.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> Phone Numbers
                </h4>
                <ul className="space-y-1">
                  {enrichment.phones.map((p) => (
                    <li key={p} className="text-sm">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {enrichment.hiring_signals.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" /> Hiring Signals
                </h4>
                <ul className="space-y-1">
                  {enrichment.hiring_signals.map((h) => (
                    <li key={h} className="text-sm text-muted-foreground">{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {enrichment.size_signals.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Size Signals</h4>
                <ul className="space-y-1">
                  {enrichment.size_signals.map((s) => (
                    <li key={s} className="text-sm text-muted-foreground">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {enrichment.keyword_matches.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Keyword Matches</h4>
                <div className="flex flex-wrap gap-1.5">
                  {enrichment.keyword_matches.map((kw) => (
                    <span key={kw} className="clay-tag bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {enrichment.source_urls.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Data Sources</h4>
                <ul className="space-y-1">
                  {enrichment.source_urls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all">
                        {url} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
