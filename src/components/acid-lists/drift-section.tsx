"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DriftDid } from "@/lib/queries";

interface DriftSectionProps {
  dialerId: string;
  drift: DriftDid[];
}

function fmtDid(did: string): string {
  if (did.length !== 10) return did;
  return `(${did.slice(0, 3)}) ${did.slice(3, 6)}-${did.slice(6)}`;
}

export default function DriftSection({ dialerId, drift }: DriftSectionProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalDrift = drift.length;
  const totalDialsOnDrift = useMemo(
    () => drift.reduce((acc, d) => acc + d.totalDials, 0),
    [drift]
  );

  async function handleAddAllToActiveList() {
    if (drift.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/dialers/${dialerId}/active-list-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dids: drift.map((d) => d.did) }),
      });
      if (res.ok) {
        const body = (await res.json()) as { added: number };
        setStatus(`Added ${body.added.toLocaleString()} DIDs to the active list.`);
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        setStatus(`Failed: ${body.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-lg border bg-black/50 backdrop-blur overflow-hidden"
      style={{ borderColor: totalDrift > 0 ? "#ffa50066" : "rgba(255,255,255,0.1)" }}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <div
            className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase"
            style={{
              color: totalDrift > 0 ? "#ffa500" : "rgba(255,255,255,0.4)",
              textShadow: totalDrift > 0 ? "0 0 6px rgba(255,165,0,0.5)" : undefined,
            }}
          >
            [ DETECTED &mdash; NOT IN ACTIVE LIST ]
          </div>
          <div className="font-mono text-[0.65rem] text-white/50 mt-1">
            DIDs seen in call logs that aren&rsquo;t in the active ACID list.
            {totalDrift > 0 && (
              <> Likely auto-procured or manually added in Convoso.</>
            )}
          </div>
        </div>
        {totalDrift > 0 && (
          <button
            onClick={handleAddAllToActiveList}
            disabled={busy || isPending}
            className="font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10 disabled:opacity-40"
          >
            {busy ? "Adding..." : `+ Add all ${totalDrift} to active list`}
          </button>
        )}
      </div>
      {status && (
        <div className="px-4 py-2 border-b border-white/10 text-xs font-mono text-white/70">
          {status}
        </div>
      )}
      {totalDrift === 0 ? (
        <div className="px-4 py-6 text-center font-mono text-xs text-white/40">
          No drift. Every DID seen in call logs is in the active ACID list.
        </div>
      ) : (
        <>
          <div className="px-4 py-2 border-b border-white/5 font-mono text-[0.65rem] text-white/50">
            {totalDrift.toLocaleString()} DIDs · {totalDialsOnDrift.toLocaleString()}{" "}
            dials on detected DIDs
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/70">
                <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40 border-b border-white/10">
                  <th className="px-4 py-3">DID</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3 text-right">Dials</th>
                  <th className="px-4 py-3">Last used</th>
                  <th className="px-4 py-3">First seen</th>
                </tr>
              </thead>
              <tbody>
                {drift.slice(0, 200).map((d) => (
                  <tr
                    key={d.did}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-white/80">
                      {fmtDid(d.did)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-white/60">
                      {d.areaCode}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-[#00bfff] text-right">
                      {d.totalDials.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-white/50">
                      {d.lastUsedDate ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-white/50">
                      {d.firstSeenAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {drift.length > 200 && (
            <div className="px-4 py-2 border-t border-white/5 text-center font-mono text-[0.65rem] text-white/40">
              Showing top 200 by dial count. Total: {drift.length.toLocaleString()}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
