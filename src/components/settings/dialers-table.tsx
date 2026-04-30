"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Dialer } from "@/db/schema";
import AddDialerModal from "./add-dialer-modal";
import EditDialerModal from "./edit-dialer-modal";

interface DialersTableProps {
  dialers: Dialer[];
  acidListsByDialer: Record<
    string,
    Array<{ id: string; name: string; didCount: number }>
  >;
  contactRateReportsByDialer: Record<
    string,
    Array<{
      id: string;
      name: string;
      didCount: number;
      totalCalls: number;
      totalContacts: number;
    }>
  >;
  recentSyncs: Array<{
    dialerId: string;
    status: "running" | "success" | "failed";
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  }>;
}

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DialersTable({
  dialers,
  acidListsByDialer,
  contactRateReportsByDialer,
  recentSyncs,
}: DialersTableProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Dialer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Dialer | null>(null);
  const [resetConfirm, setResetConfirm] = useState<Dialer | null>(null);
  const [typedName, setTypedName] = useState("");
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const latestByDialer = new Map<string, (typeof recentSyncs)[number]>();
  for (const r of recentSyncs) {
    const existing = latestByDialer.get(r.dialerId);
    if (!existing || r.startedAt > existing.startedAt) {
      latestByDialer.set(r.dialerId, r);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    if (typedName !== deleteConfirm.name) return;
    const id = deleteConfirm.id;
    const res = await fetch(`/api/dialers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirm(null);
      setTypedName("");
      startTransition(() => router.refresh());
    }
  }

  async function handleReset() {
    if (!resetConfirm) return;
    if (typedName !== resetConfirm.name) return;
    const id = resetConfirm.id;
    setIsResetting(id);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/dialers/${id}/reset`, { method: "POST" });
      if (res.ok) {
        const body = await res.json();
        setSyncResult(
          `Reset complete: deleted ${body.didsDeleted ?? 0} DIDs + stats. Click "Run Full Sync" next to rebuild.`
        );
        setResetConfirm(null);
        setTypedName("");
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => ({ error: "Reset failed" }));
        setSyncResult(`Reset failed: ${body.error ?? res.status}`);
      }
    } catch (err) {
      setSyncResult(`Reset error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsResetting(null);
    }
  }

  async function handleRunSync(dialerId: string) {
    setIsSyncing(dialerId);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/sync/full?dialerId=${dialerId}`, {
        method: "POST",
      });
      if (res.ok) {
        setSyncResult(`Sync triggered for dialer.`);
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => ({ error: "Sync failed" }));
        setSyncResult(`Sync failed: ${body.error ?? res.status}`);
      }
    } catch (err) {
      setSyncResult(`Sync error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsSyncing(null);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div
          className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#39ff14]"
          style={{ textShadow: "0 0 6px rgba(57,255,20,0.6)" }}
        >
          [ DIALERS ]
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10"
        >
          + Add Dialer
        </button>
      </div>
      {syncResult && (
        <div className="px-4 py-2 border-b border-white/10 text-xs font-mono text-white/70">
          {syncResult}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-black/70">
            <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40 border-b border-white/10">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">API URL</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Last sync</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dialers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center font-mono text-xs text-white/40"
                >
                  No dialers configured. Add your first dialer to get started.
                </td>
              </tr>
            ) : (
              dialers.map((d) => {
                const latest = latestByDialer.get(d.id);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-[#39ff14]">
                      {d.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                      {d.convosoApiUrl}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/40">
                      ••••••••
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-mono text-[0.55rem] px-2 py-0.5 rounded border uppercase tracking-wider ${
                          d.isActive
                            ? "border-[#39ff14]/40 text-[#39ff14]"
                            : "border-white/20 text-white/40"
                        }`}
                      >
                        {d.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                      {latest ? (
                        <span
                          style={{
                            color:
                              latest.status === "success"
                                ? "#39ff14"
                                : latest.status === "failed"
                                  ? "#ff003c"
                                  : "#ffdd57",
                          }}
                        >
                          {latest.status} · {timeAgo(latest.startedAt)}
                        </span>
                      ) : (
                        "never"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <button
                        onClick={() => handleRunSync(d.id)}
                        disabled={isSyncing === d.id || isPending}
                        className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#00bfff]/40 text-[#00bfff] hover:bg-[#00bfff]/10 rounded disabled:opacity-50"
                      >
                        {isSyncing === d.id ? "Running..." : "Run Full Sync"}
                      </button>
                      <button
                        onClick={() => {
                          setResetConfirm(d);
                          setTypedName("");
                        }}
                        disabled={isResetting === d.id}
                        className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#ffa500]/40 text-[#ffa500] hover:bg-[#ffa500]/10 rounded disabled:opacity-50"
                      >
                        {isResetting === d.id ? "Resetting..." : "Reset Stats"}
                      </button>
                      <button
                        onClick={() => setEditing(d)}
                        className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-white/20 text-white/70 hover:bg-white/10 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm(d);
                          setTypedName("");
                        }}
                        className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#ff003c]/40 text-[#ff003c] hover:bg-[#ff003c]/10 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <AddDialerModal onClose={() => setShowAdd(false)} />}
      {editing && (
        <EditDialerModal
          dialer={editing}
          acidLists={acidListsByDialer[editing.id] ?? []}
          contactRateReports={contactRateReportsByDialer[editing.id] ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {mounted && resetConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
              <div className="rounded-lg border border-[#ffa500]/40 bg-black p-8 max-w-xl w-full space-y-5 my-8 shadow-[0_0_40px_rgba(255,165,0,0.15)]">
                <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-[#ffa500]">
                  Reset Stats
                </h2>
                <p className="font-mono text-xs text-white/70 leading-relaxed">
                  Wipes all DIDs, daily stats, and live pulse for {resetConfirm.name}.
                  ACID lists, contact-rate reports, and sync history are preserved.
                  After reset, click &quot;Run Full Sync&quot; to rebuild from Convoso call logs.
                  Type the dialer name to confirm.
                </p>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={resetConfirm.name}
                  className="w-full bg-black/60 border border-[#ffa500]/40 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#ffa500]"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setResetConfirm(null);
                      setTypedName("");
                    }}
                    className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-white/20 text-white/70 hover:bg-white/10 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={typedName !== resetConfirm.name}
                    className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-[#ffa500] text-[#ffa500] hover:bg-[#ffa500]/10 rounded disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      {mounted && deleteConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
              <div className="rounded-lg border border-[#ff003c]/40 bg-black p-8 max-w-xl w-full space-y-5 my-8 shadow-[0_0_40px_rgba(255,0,60,0.15)]">
                <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-[#ff003c]">
                  Delete Dialer
                </h2>
                <p className="font-mono text-xs text-white/70 leading-relaxed">
                  This will destroy {deleteConfirm.name} and cascade all DIDs, stats,
                  and ACID lists. Type the dialer name to confirm.
                </p>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={deleteConfirm.name}
                  className="w-full bg-black/60 border border-[#ff003c]/40 rounded px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#ff003c]"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setDeleteConfirm(null);
                      setTypedName("");
                    }}
                    className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-white/20 text-white/70 hover:bg-white/10 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={typedName !== deleteConfirm.name}
                    className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 border border-[#ff003c] text-[#ff003c] hover:bg-[#ff003c]/10 rounded disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
