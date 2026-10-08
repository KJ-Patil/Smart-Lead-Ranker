"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CSVUploadProps {
  icpId: string;
  onUpload: (result: { uploaded: number; deduplicated: number }) => void;
}

export function CSVUpload({ icpId, onUpload }: CSVUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError("");
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("File too large. Maximum 1MB.");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp_id: icpId, csv_content: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUpload({ uploaded: data.uploaded, deduplicated: data.deduplicated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/data/sample-leads.csv");
      if (!res.ok) throw new Error("Sample file not found");
      const text = await res.text();

      const uploadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp_id: icpId, csv_content: text }),
      });

      const data = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(data.error || "Upload failed");
      onUpload({ uploaded: data.uploaded, deduplicated: data.deduplicated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Upload Leads</h2>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div
        className={cn(
          "clay-drop-zone border-2 border-dashed p-5 text-center transition-colors cursor-pointer",
          dragging ? "!border-primary bg-primary/5" : "border-border hover:border-primary/50",
          loading && "pointer-events-none opacity-50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        {loading ? (
          <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
        ) : (
          <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
        )}
        <p className="mt-3 text-sm font-medium">
          {loading ? "Uploading..." : "Drop CSV here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Columns: company_name, website (required), contact_name, contact_email (optional)
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <button
        onClick={loadSample}
        disabled={loading}
        className={cn(
          "clay-btn w-full border px-4 py-2.5 text-sm font-medium",
          "hover:bg-accent transition-colors disabled:opacity-50"
        )}
      >
        Load Sample CSV (30 companies)
      </button>
    </div>
  );
}
