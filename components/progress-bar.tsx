"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  jobId: string;
  onComplete: () => void;
}

export function ProgressBar({ jobId, onComplete }: ProgressBarProps) {
  const [progress, setProgress] = useState({ processed: 0, total: 0, status: "processing" });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        setProgress({
          processed: job.processed_leads,
          total: job.total_leads,
          status: job.status,
        });
        if (job.status === "completed" || job.status === "failed") {
          clearInterval(interval);
          setTimeout(onComplete, 500);
        }
      } catch { /* ignore polling errors */ }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="clay-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {progress.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <span className="text-sm font-medium">
          {progress.status === "completed"
            ? "Enrichment complete!"
            : progress.status === "failed"
              ? "Enrichment failed"
              : `Enriching leads... ${progress.processed} / ${progress.total}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progress.status === "failed" ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {progress.status === "processing" && "Fetching public pages, extracting data, and scoring each lead..."}
        {progress.status === "completed" && "All leads have been enriched and scored. Review results below."}
        {progress.status === "failed" && "Some leads may have failed. Check the results table."}
      </p>
    </div>
  );
}
