"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ReportRow {
  id: string;
  name: string;
  periodFrom: string | null;
  periodTo: string | null;
  totalCalls: number;
  totalContacts: number;
  didCount: number;
  uploadedAt: Date;
}

interface ReportsTableProps {
  dialerId: string;
  activeReportId: string | null;
  reports: ReportRow[];
}

export default function ReportsTable({
  dialerId,
  activeReportId,
  reports,
}: ReportsTableProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contact-rate-reports/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setStatus("Report deleted.");
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
        body: JSON.stringify({ activeContactRateReportId: id }),
      });
      if (res.ok) {
        setStatus(id ? "Active report updated." : "Active report cleared.");
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
          [ CONTACT RATE REPORTS ]
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
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">DIDs</th>
              <th className="px-4 py-3 text-right">Calls</th>
              <th className="px-4 py-3 text-right">Contacts</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center font-mono text-xs text-white/40"
                >
                  No reports uploaded yet.
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const isActive = r.id === activeReportId;
                const rate =
                  r.totalCalls > 0
                    ? ((r.totalContacts / r.totalCalls) * 100).toFixed(2) + "%"
                    : "—";
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      isActive ? "bg-[#00bfff]/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {isActive && (
                          <span
                            className="font-mono text-[0.55rem] px-2 py-0.5 rounded border border-[#00bfff]/60 text-[#00bfff] uppercase tracking-wider"
                            style={{ textShadow: "0 0 6px rgba(0,191,255,0.6)" }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                      {r.periodFrom && r.periodTo
                        ? `${r.periodFrom} → ${r.periodTo}`
                        : r.periodFrom
                          ? `from ${r.periodFrom}`
                          : r.periodTo
                            ? `to ${r.periodTo}`
                            : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-white/70 text-right">
                      {r.didCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-white/70 text-right">
                      {r.totalCalls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-white/70 text-right">
                      {r.totalContacts.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-[#00bfff] text-right">
                      {rate}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white/50">
                      {r.uploadedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {confirming === r.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={isPending}
                            onClick={() => handleDelete(r.id)}
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
                              onClick={() => handleSetActive(r.id)}
                              disabled={settingActive !== null || isPending}
                              className="font-mono text-[0.6rem] uppercase tracking-wider px-2 py-1 border border-[#00bfff]/40 text-[#00bfff] hover:bg-[#00bfff]/10 rounded disabled:opacity-40"
                            >
                              {settingActive === r.id ? "..." : "Set Active"}
                            </button>
                          )}
                          <button
                            onClick={() => setConfirming(r.id)}
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
