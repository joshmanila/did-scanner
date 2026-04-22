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
  dialerId: string;
  activeAcidListId: string | null;
  lists: ListRow[];
}

export default function ListsTable({
  dialerId,
  activeAcidListId,
  lists,
}: ListsTableProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [settingActive, setSettingActive] = useState<string | null>(null);
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

  async function handleSetActive(id: string | null) {
    setSettingActive(id ?? "clear");
    try {
      const res = await fetch(`/api/dialers/${dialerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeAcidListId: id }),
      });
      if (res.ok) {
        setStatus(id ? "Active list updated." : "Active list cleared.");
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => ({ error: "Update failed" }));
        setStatus(`Update failed: ${body.error}`);
      }
    } finally {
      setSettingActive(null);
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
              lists.map((l) => {
                const isActive = l.id === activeAcidListId;
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      isActive ? "bg-[#39ff14]/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <span>{l.name}</span>
                        {isActive && (
                          <span
                            className="font-mono text-[0.55rem] px-2 py-0.5 rounded border border-[#39ff14]/40 text-[#39ff14] uppercase tracking-wider"
                            style={{ textShadow: "0 0 6px rgba(57,255,20,0.6)" }}
                          >
                            Active
                          </span>
                        )}
                      </div>
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
                        <div className="flex justify-end gap-2">
                          {isActive ? (
                            <button
                              onClick={() => handleSetActive(null)}
                              disabled={settingActive !== null || isPending}
                              className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-white/20 text-white/70 hover:bg-white/10 rounded disabled:opacity-40"
                            >
                              Clear Active
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetActive(l.id)}
                              disabled={settingActive !== null || isPending}
                              className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10 rounded disabled:opacity-40"
                            >
                              {settingActive === l.id ? "..." : "Set Active"}
                            </button>
                          )}
                          <button
                            onClick={() => setConfirming(l.id)}
                            className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#ff003c]/40 text-[#ff003c] hover:bg-[#ff003c]/10 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
