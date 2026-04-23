"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CSVUpload from "@/components/csv-upload";

interface UploadFormProps {
  dialerId: string;
}

export default function ContactRateUploadForm({ dialerId }: UploadFormProps) {
  const router = useRouter();
  const [reportName, setReportName] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = useCallback(
    (file: File) => {
      setPendingFile(file);
      setError(null);
      setStatus(`Selected ${file.name}`);
      if (!reportName)
        setReportName(file.name.replace(/\.(csv|tsv|txt)$/i, ""));
    },
    [reportName]
  );

  async function handleUpload() {
    if (!pendingFile) {
      setError("Select a CSV file first.");
      return;
    }
    if (!reportName.trim()) {
      setError("Provide a report name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const csv = await pendingFile.text();
      const res = await fetch("/api/contact-rate-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialerId,
          name: reportName.trim(),
          csv,
          periodFrom: periodFrom || null,
          periodTo: periodTo || null,
        }),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "Upload failed" }));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as {
        didCount: number;
        totalCalls: number;
        totalContacts: number;
        skipped: number;
      };
      const rate =
        body.totalCalls > 0
          ? ((body.totalContacts / body.totalCalls) * 100).toFixed(2)
          : "0.00";
      setStatus(
        `Uploaded "${reportName.trim()}" · ${body.didCount.toLocaleString()} DIDs · overall ${rate}% (${body.totalContacts.toLocaleString()}/${body.totalCalls.toLocaleString()})${body.skipped > 0 ? ` · skipped ${body.skipped} rows` : ""}`
      );
      setPendingFile(null);
      setReportName("");
      setPeriodFrom("");
      setPeriodTo("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-4 space-y-3">
      <div
        className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
        style={{ textShadow: "0 0 6px rgba(0,191,255,0.6)" }}
      >
        [ UPLOAD CONTACT RATE REPORT ]
      </div>
      <div className="font-mono text-[0.65rem] text-white/50 leading-relaxed">
        Export from Convoso → Reports → Custom Reports → Contact Rate Report
        (broken down by DID). Do NOT open in Excel first — it mangles the DID
        column into scientific notation. Upload the file directly.
      </div>

      <label className="block space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
          Report name
        </span>
        <input
          type="text"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          placeholder="e.g. USA Closers — Apr 1 to Apr 22"
          className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#00bfff]/60"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
            Period from (optional)
          </span>
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
            Period to (optional)
          </span>
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          />
        </label>
      </div>

      <CSVUpload onFileSelected={handleFile} isLoading={isLoading} />
      {error && <div className="font-mono text-xs text-[#ff003c]">{error}</div>}
      {status && !error && (
        <div className="font-mono text-xs text-white/70">{status}</div>
      )}
      <button
        onClick={handleUpload}
        disabled={isLoading || isPending || !pendingFile}
        className="font-mono text-xs font-bold uppercase tracking-wider px-4 py-2 rounded border border-[#00bfff]/40 text-[#00bfff] hover:bg-[#00bfff]/10 disabled:opacity-40"
      >
        {isLoading ? "Uploading..." : "Upload Report"}
      </button>
    </div>
  );
}
