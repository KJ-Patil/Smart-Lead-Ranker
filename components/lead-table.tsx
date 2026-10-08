"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ArrowUpDown, Mail, Phone, Briefcase,
  CheckCircle2, XCircle, MessageSquare, ChevronLeft, ChevronRight,
  Trash2, AlertTriangle,
} from "lucide-react";
import type { Lead } from "@/lib/types";
import { cn, getScoreColor, getScoreLabel, getQualityColor } from "@/lib/utils";

interface LeadTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onStatusChange: (id: string, status: Lead["status"]) => void;
  onDeleteLead: (id: string) => void;
  selectedLeadId?: string;
}

const PAGE_SIZE = 10;

export function LeadTable({ leads, onSelectLead, onStatusChange, onDeleteLead, selectedLeadId }: LeadTableProps) {
  const [sortBy, setSortBy] = useState<"score" | "name" | "quality">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [focusedRow, setFocusedRow] = useState(-1);
  const [filters, setFilters] = useState({
    scoreMin: 0,
    scoreMax: 100,
    hasEmail: false,
    hasHiring: false,
    status: "all" as string,
  });

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (l.score < filters.scoreMin || l.score > filters.scoreMax) return false;
      if (filters.hasEmail && (!l.enrichment?.emails.length)) return false;
      if (filters.hasHiring && (!l.enrichment?.hiring_signals.length)) return false;
      if (filters.status !== "all" && l.status !== filters.status) return false;
      return true;
    });
  }, [leads, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "score") return (a.score - b.score) * dir;
      if (sortBy === "name") return a.company_name.localeCompare(b.company_name) * dir;
      const qualOrder = { high: 3, medium: 2, low: 1 };
      return (qualOrder[a.data_quality] - qualOrder[b.data_quality]) * dir;
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedRow((prev) => Math.min(prev + 1, paginated.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedRow((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && focusedRow >= 0 && focusedRow < paginated.length) {
      onSelectLead(paginated[focusedRow]);
    }
  }, [focusedRow, paginated, onSelectLead]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="clay-stat flex flex-wrap gap-3 items-center p-3">
        <label className="text-xs font-medium text-muted-foreground">Filters:</label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">Score</span>
          <input type="number" min={0} max={100} value={filters.scoreMin}
            onChange={(e) => { setFilters({ ...filters, scoreMin: +e.target.value }); setPage(0); }}
            className="clay-input w-14 px-1.5 py-1 text-xs focus:outline-none" />
          <span className="text-xs">-</span>
          <input type="number" min={0} max={100} value={filters.scoreMax}
            onChange={(e) => { setFilters({ ...filters, scoreMax: +e.target.value }); setPage(0); }}
            className="clay-input w-14 px-1.5 py-1 text-xs focus:outline-none" />
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={filters.hasEmail}
            onChange={(e) => { setFilters({ ...filters, hasEmail: e.target.checked }); setPage(0); }}
            className="rounded" />
          Has Email
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={filters.hasHiring}
            onChange={(e) => { setFilters({ ...filters, hasHiring: e.target.checked }); setPage(0); }}
            className="rounded" />
          Hiring
        </label>
        <select
          value={filters.status}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(0); }}
          className="clay-input px-2 py-1 text-xs focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="good">Good</option>
          <option value="bad">Bad</option>
          <option value="contacted">Contacted</option>
          <option value="needs_review">Needs Review</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {leads.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="clay-card overflow-x-auto !p-0" onKeyDown={handleKeyDown} tabIndex={0} role="grid"
        aria-label="Leads table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/30">
              <th className="px-3 py-2.5 text-left font-medium">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-primary">
                  Company <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                <button onClick={() => toggleSort("score")} className="flex items-center gap-1 hover:text-primary">
                  Score <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                <button onClick={() => toggleSort("quality")} className="flex items-center gap-1 hover:text-primary">
                  Quality <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Signals</th>
              <th className="px-3 py-2.5 text-left font-medium">Why</th>
              <th className="px-3 py-2.5 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No leads match your filters
                </td>
              </tr>
            ) : (
              paginated.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={cn(
                    "border-b cursor-pointer transition-colors hover:bg-accent/50",
                    selectedLeadId === lead.id && "bg-primary/5",
                    focusedRow === idx && "ring-2 ring-inset ring-primary/40",
                    lead.status === "needs_review" && "bg-amber-50/50 dark:bg-amber-950/30"
                  )}
                  role="row"
                  aria-selected={selectedLeadId === lead.id}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {lead.status === "needs_review" && (
                        <span title="Needs manual review"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>
                      )}
                      <div>
                        <div className="font-medium">{lead.company_name}</div>
                        <div className="text-xs text-muted-foreground">{lead.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", getScoreColor(lead.score))}>
                      {lead.score} — {getScoreLabel(lead.score)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", getQualityColor(lead.data_quality))}>
                      {lead.data_quality}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      {(lead.enrichment?.emails?.length ?? 0) > 0 && (
                        <span title="Has email"><Mail className="h-4 w-4 text-blue-500" /></span>
                      )}
                      {(lead.enrichment?.phones?.length ?? 0) > 0 && (
                        <span title="Has phone"><Phone className="h-4 w-4 text-green-500" /></span>
                      )}
                      {(lead.enrichment?.hiring_signals?.length ?? 0) > 0 && (
                        <span title="Hiring"><Briefcase className="h-4 w-4 text-purple-500" /></span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.status === "needs_review" ? "Blocked — needs manual review" : lead.llm_reason || "Not enriched yet"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange(lead.id, "good"); }}
                        title="Mark Good"
                        aria-label="Mark Good"
                        className={cn("p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900", lead.status === "good" && "bg-emerald-100 dark:bg-emerald-900")}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange(lead.id, "bad"); }}
                        title="Mark Bad"
                        aria-label="Mark Bad"
                        className={cn("p-1 rounded hover:bg-red-100 dark:hover:bg-red-900", lead.status === "bad" && "bg-red-100 dark:bg-red-900")}
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange(lead.id, "contacted"); }}
                        title="Mark Contacted"
                        aria-label="Mark Contacted"
                        className={cn("p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900", lead.status === "contacted" && "bg-blue-100 dark:bg-blue-900")}
                      >
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteLead(lead.id); }}
                        title="Delete lead"
                        aria-label="Delete lead"
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="clay-btn border p-1.5 hover:bg-accent disabled:opacity-30"
              aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="clay-btn border p-1.5 hover:bg-accent disabled:opacity-30"
              aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
