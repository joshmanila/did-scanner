"use client";

import { useState, useMemo } from "react";
import type { GapAnalysisEntry } from "@/lib/gap-analysis";

const STATUS_COLORS: Record<string, string> = {
  "no-coverage": "#ff003c",
  "low-coverage": "#ffdd00",
  "good-coverage": "#39ff14",
};

const STATUS_LABELS: Record<string, string> = {
  "no-coverage": "NO COVERAGE",
  "low-coverage": "LOW",
  "good-coverage": "GOOD",
};

interface GapAnalysisTableProps {
  entries: GapAnalysisEntry[];
}

export default function GapAnalysisTable({ entries }: GapAnalysisTableProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = entries;
    if (filterStatus) {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.areaCode.includes(q) ||
          e.city.toLowerCase().includes(q) ||
          e.state.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, search, filterStatus]);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#00bfff]/20 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-[#00bfff]/10 flex items-center justify-between gap-4 flex-wrap">
        <div
          className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
          style={{ textShadow: "0 0 6px rgba(0, 191, 255, 0.6)" }}
        >
          [ GAP ANALYSIS ]
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter buttons */}
          <div className="flex gap-1">
            {(["no-coverage", "low-coverage", "good-coverage"] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() =>
                    setFilterStatus(filterStatus === status ? null : status)
                  }
                  className={`
                    font-mono text-[0.55rem] px-2 py-1 rounded border transition-all uppercase tracking-wider
                    ${
                      filterStatus === status
                        ? "bg-white/10"
                        : "bg-transparent hover:bg-white/5"
                    }
                  `}
                  style={{
                    borderColor:
                      filterStatus === status
                        ? STATUS_COLORS[status]
                        : `${STATUS_COLORS[status]}40`,
                    color: STATUS_COLORS[status],
                  }}
                >
                  {STATUS_LABELS[status]}
                </button>
              )
            )}
          </div>

          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-black/60 border border-[#00bfff]/20 rounded px-3 py-1.5 text-xs font-mono text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#00bfff]/50 w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-black/90 z-10">
            <tr className="font-mono text-[0.65rem] uppercase tracking-wider text-white/40 border-b border-[#00bfff]/10">
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Area Code</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Calls</th>
              <th className="px-4 py-3 text-right">DIDs</th>
              <th className="px-4 py-3 text-right">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const color = STATUS_COLORS[entry.status];
              return (
                <tr
                  key={entry.areaCode}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block font-mono text-[0.55rem] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        color,
                        backgroundColor: `${color}15`,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2.5 font-mono text-sm"
                    style={{ color: `${color}cc` }}
                  >
                    ({entry.areaCode})
                  </td>
                  <td className="px-4 py-2.5 text-sm text-white/70">
                    {entry.city}, {entry.state}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-white/80 text-right">
                    {entry.callCount.toLocaleString()}
                  </td>
                  <td
                    className="px-4 py-2.5 text-sm font-mono font-bold text-right"
                    style={{ color: `${color}cc` }}
                  >
                    {entry.didCount}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-white/50 text-right">
                    {entry.callCount > 0
                      ? `${(entry.ratio * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-[#00bfff]/10 text-xs font-mono text-white/30">
        {filtered.length} of {entries.length} area code
        {entries.length !== 1 ? "s" : ""} shown
      </div>
    </div>
  );
}
