"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ListRow {
  id: string;
  dialerId: string;
  name: string;
  uploadedAt: Date;
  didCount: number;
}

interface ListsTableProps {
  lists: ListRow[];
}

export default function ListsTable({ lists }: ListsTableProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/acid-lists/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus("List deleted.");
      setConfirming(null);
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({ error: "Delete failed" }));
      setStatus(`Delete failed: ${body.error}`);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div
          className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
          style={{ textShadow: "0 0 6px rgba(0,191,255,0.6)" }}
        >
          [ ACID LISTS ]
        </div>
      </div>
      {status && (
        <div className="px-4 py-2 border-b border-white/10 text-xs font-mono text-white/70">
          {status}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-black/70">
            <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40 border-b border-white/10">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">DIDs</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lists.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center font-mono text-xs text-white/40"
                >
                  No lists yet.
                </td>
              </tr>
            ) : (
              lists.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-sm text-white/80">
                    {l.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-[#00bfff] text-right">
                    {l.didCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/50">
                    {l.uploadedAt.toISOString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {confirming === l.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={isPending}
                          onClick={() => handleDelete(l.id)}
                          className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#ff003c] text-[#ff003c] hover:bg-[#ff003c]/10 rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirming(null)}
                          className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-white/20 text-white/70 hover:bg-white/10 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirming(l.id)}
                        className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#ff003c]/40 text-[#ff003c] hover:bg-[#ff003c]/10 rounded"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
