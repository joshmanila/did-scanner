"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Dialer } from "@/db/schema";

interface EditDialerModalProps {
  dialer: Dialer;
  acidLists: Array<{ id: string; name: string; didCount: number }>;
  contactRateReports: Array<{
    id: string;
    name: string;
    didCount: number;
    totalCalls: number;
    totalContacts: number;
  }>;
  onClose: () => void;
}

export default function EditDialerModal({
  dialer,
  acidLists,
  contactRateReports,
  onClose,
}: EditDialerModalProps) {
  const router = useRouter();
  const [name, setName] = useState(dialer.name);
  const [apiUrl, setApiUrl] = useState(dialer.convosoApiUrl);
  const [isActive, setIsActive] = useState(dialer.isActive);
  const [activeAcidListId, setActiveAcidListId] = useState<string>(
    dialer.activeAcidListId ?? ""
  );
  const [activeContactRateReportId, setActiveContactRateReportId] =
    useState<string>(dialer.activeContactRateReportId ?? "");
  const [authToken, setAuthToken] = useState("");
  const [replaceToken, setReplaceToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name,
        apiUrl,
        isActive,
        activeAcidListId: activeAcidListId === "" ? null : activeAcidListId,
        activeContactRateReportId:
          activeContactRateReportId === ""
            ? null
            : activeContactRateReportId,
      };
      if (replaceToken && authToken) {
        body.authToken = authToken;
      }
      const res = await fetch(`/api/dialers/${dialer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const bodyRes = await res.json().catch(() => ({ error: "Update failed" }));
        setError(bodyRes.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        router.refresh();
        onClose();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-[#00bfff]/40 bg-black p-8 max-w-xl w-full space-y-5 my-8 shadow-[0_0_40px_rgba(0,191,255,0.15)]"
        >
        <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-[#00bfff]">
          Edit Dialer
        </h2>
        <label className="block space-y-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-white/60">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-white/60">
            API URL
          </span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            required
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className="font-mono text-xs text-white/70">Active</span>
        </label>
        <label className="block space-y-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-white/60">
            Active ACID List
          </span>
          <select
            value={activeAcidListId}
            onChange={(e) => setActiveAcidListId(e.target.value)}
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          >
            <option value="">— none (ACID feature disabled) —</option>
            {acidLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.didCount.toLocaleString()} DIDs)
              </option>
            ))}
          </select>
          {acidLists.length === 0 && (
            <span className="block font-mono text-[0.6rem] text-white/40">
              No ACID lists uploaded for this dialer yet. Upload one from the
              dialer&rsquo;s ACID Lists tab.
            </span>
          )}
        </label>
        <label className="block space-y-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-white/60">
            Active Contact Rate Report
          </span>
          <select
            value={activeContactRateReportId}
            onChange={(e) => setActiveContactRateReportId(e.target.value)}
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          >
            <option value="">— none (use estimated rate from call logs) —</option>
            {contactRateReports.map((r) => {
              const rate =
                r.totalCalls > 0
                  ? `${((r.totalContacts / r.totalCalls) * 100).toFixed(2)}%`
                  : "—";
              return (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.didCount.toLocaleString()} DIDs · {rate})
                </option>
              );
            })}
          </select>
          {contactRateReports.length === 0 && (
            <span className="block font-mono text-[0.6rem] text-white/40">
              No contact rate reports uploaded yet. Upload one from the
              dialer&rsquo;s Contact Rate tab.
            </span>
          )}
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={replaceToken}
              onChange={(e) => setReplaceToken(e.target.checked)}
            />
            <span className="font-mono text-xs text-white/70">
              Replace auth token
            </span>
          </label>
          {replaceToken && (
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="new token"
              className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
            />
          )}
        </div>
        {error && (
          <div className="font-mono text-xs text-[#ff003c]">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-white/20 text-white/70 hover:bg-white/10 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isPending}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-[#00bfff]/60 text-[#00bfff] hover:bg-[#00bfff]/10 rounded disabled:opacity-40"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
