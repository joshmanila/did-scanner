"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dialer } from "@/db/schema";

interface EditDialerModalProps {
  dialer: Dialer;
  onClose: () => void;
}

export default function EditDialerModal({
  dialer,
  onClose,
}: EditDialerModalProps) {
  const router = useRouter();
  const [name, setName] = useState(dialer.name);
  const [apiUrl, setApiUrl] = useState(dialer.convosoApiUrl);
  const [isActive, setIsActive] = useState(dialer.isActive);
  const [authToken, setAuthToken] = useState("");
  const [replaceToken, setReplaceToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = { name, apiUrl, isActive };
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-[#00bfff]/40 bg-black p-6 max-w-md w-full space-y-4"
      >
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[#00bfff]">
          Edit Dialer
        </h2>
        <label className="block space-y-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
            API URL
          </span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            required
            className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
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
              className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00bfff]/60"
            />
          )}
        </div>
        {error && (
          <div className="font-mono text-xs text-[#ff003c]">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-white/20 text-white/70 hover:bg-white/10 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isPending}
            className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-[#00bfff]/60 text-[#00bfff] hover:bg-[#00bfff]/10 rounded disabled:opacity-40"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
