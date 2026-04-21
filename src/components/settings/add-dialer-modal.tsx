"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AddDialerModalProps {
  onClose: () => void;
}

export default function AddDialerModal({ onClose }: AddDialerModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.convoso.com/v1");
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/dialers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, apiUrl, authToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Create failed" }));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        router.refresh();
        onClose();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-[#39ff14]/40 bg-black p-6 max-w-md w-full space-y-4"
      >
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[#39ff14]">
          Add Dialer
        </h2>
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="VMS"
          required
        />
        <Field
          label="API URL"
          value={apiUrl}
          onChange={setApiUrl}
          placeholder="https://api.convoso.com/v1"
          required
        />
        <Field
          label="Auth Token"
          value={authToken}
          onChange={setAuthToken}
          placeholder="paste token here"
          required
          type="password"
        />
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
            className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-[#39ff14]/60 text-[#39ff14] hover:bg-[#39ff14]/10 rounded disabled:opacity-40"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14]/60"
      />
    </label>
  );
}
