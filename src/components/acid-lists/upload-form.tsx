"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCSV } from "@/lib/parse-dids";
import CSVUpload from "@/components/csv-upload";

interface UploadFormProps {
  dialerId: string;
}

export default function UploadForm({ dialerId }: UploadFormProps) {
  const router = useRouter();
  const [listName, setListName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = useCallback((file: File) => {
    setPendingFile(file);
    setError(null);
    setStatus(`Selected ${file.name}`);
    if (!listName) setListName(file.name.replace(/\.csv$/i, ""));
  }, [listName]);

  async function handleUpload() {
    if (!pendingFile) {
      setError("Select a CSV file first.");
      return;
    }
    if (!listName.trim()) {
      setError("Provide a list name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { dids, unmapped } = await parseCSV(pendingFile);
      const didStrings = dids.map((d) => d.cleaned);
      if (didStrings.length === 0) {
        setError("No DIDs parsed from this CSV.");
        return;
      }
      const res = await fetch("/api/acid-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialerId,
          name: listName.trim(),
          dids: didStrings,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const unmappedNote =
        unmapped.length > 0
          ? ` (${unmapped.length} had unrecognized area codes — still uploaded)`
          : "";
      setStatus(
        `Uploaded ${didStrings.length} DIDs as "${listName.trim()}"${unmappedNote}.`
      );
      setPendingFile(null);
      setListName("");
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
        className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#39ff14]"
        style={{ textShadow: "0 0 6px rgba(57,255,20,0.6)" }}
      >
        [ UPLOAD ACID LIST ]
      </div>

      <label className="block space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
          List name
        </span>
        <input
          type="text"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="e.g. November Main List"
          className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14]/60"
        />
      </label>

      <CSVUpload onFileSelected={handleFile} isLoading={isLoading} />
      {error && (
        <div className="font-mono text-xs text-[#ff003c]">{error}</div>
      )}
      {status && !error && (
        <div className="font-mono text-xs text-white/60">{status}</div>
      )}
      <button
        onClick={handleUpload}
        disabled={isLoading || isPending || !pendingFile}
        className="font-mono text-xs font-bold uppercase tracking-wider px-4 py-2 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10 disabled:opacity-40"
      >
        {isLoading ? "Uploading..." : "Upload List"}
      </button>
    </div>
  );
}
