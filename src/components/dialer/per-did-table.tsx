"use client";

import { useMemo, useState } from "react";
import type { DidRowForTable } from "@/lib/aggregates";
import areaCodesData from "@/lib/area-codes.json";
import { csvSafeFileName, downloadCsv } from "@/lib/csv-export";

interface AreaCodeInfo {
  city: string;
  state: string;
  country: string;
}

const AREA_CODES = areaCodesData as Record<string, AreaCodeInfo>;

type Filter =
  | "all"
  | "dormant"
  | "underused"
  | "healthy"
  | "overused"
  | "inList"
  | "notInList";

interface AcidListOption {
  id: string;
  name: string;
  didCount: number;
}

interface PerDidTableProps {
  rows: DidRowForTable[];
  dialerName: string;
  acidLists: AcidListOption[];
  membershipByDid: Record<string, string[]>;
}

function fmtDid(raw: string): string {
  if (raw.length === 10) {
    return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return raw;
}

function fmtLength(sec: number): string {
  const s = Math.round(sec);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type SortKey =
  | "did"
  | "areaCode"
  | "totalDials"
  | "dialsPerDay"
  | "totalAnswered"
  | "answeredPct"
  | "avgLengthSec"
  | "lastUsedDate";

export default function PerDidTable({
  rows,
  dialerName,
  acidLists,
  membershipByDid,
}: PerDidTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [acidListId, setAcidListId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalDials");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = rows;
    if (acidListId !== "all") {
      result = result.filter((r) =>
        (membershipByDid[r.did] ?? []).includes(acidListId)
      );
    }
    switch (filter) {
      case "dormant":
        result = result.filter((r) => r.band === "dormant");
        break;
      case "underused":
        result = result.filter((r) => r.band === "underused");
        break;
      case "healthy":
        result = result.filter((r) => r.band === "healthy");
        break;
      case "overused":
        result = result.filter((r) => r.band === "overused");
        break;
      case "inList":
        result = result.filter((r) => r.inAcidList);
        break;
      case "notInList":
        result = result.filter((r) => !r.inAcidList && r.totalDials > 0);
        break;
      case "all":
      default:
        break;
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.did.includes(q) || r.areaCode.includes(q)
      );
    }
    const sorted = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        const as = String(aVal ?? "");
        const bs = String(bVal ?? "");
        cmp = as.localeCompare(bs);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [rows, filter, acidListId, membershipByDid, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "desc" ? " ▼" : " ▲";
  }

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `did-scanner-${csvSafeFileName(dialerName)}-per-did-${today}.csv`;
    const exportRows = filtered.map((r) => {
      const info = AREA_CODES[r.areaCode];
      return {
        did: r.did,
        area_code: r.areaCode,
        city: info?.city ?? "",
        state: info?.state ?? "",
        total_dials: r.totalDials,
        dials_per_day: r.dialsPerDay.toFixed(2),
        answered: r.totalAnswered,
        answered_pct: (r.answeredPct * 100).toFixed(2),
        avg_length_mmss: fmtLength(r.avgLengthSec),
        last_used: r.lastUsedDate ?? "",
        status: r.bandLabel,
        in_acid_list: r.inAcidList ? "yes" : "no",
      };
    });
    downloadCsv(exportRows, filename);
  }

  const FILTER_OPTIONS: Array<{ key: Filter; label: string; color: string }> = [
    { key: "all", label: "All", color: "#ffffff" },
    { key: "dormant", label: "Dormant", color: "#ff3860" },
    { key: "underused", label: "Underused", color: "#ffdd57" },
    { key: "healthy", label: "Healthy", color: "#39ff14" },
    { key: "overused", label: "Overused", color: "#ff9500" },
    { key: "inList", label: "Only in list", color: "#00bfff" },
    { key: "notInList", label: "Only in calls, not in list", color: "#a020f0" },
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className="font-mono text-[0.55rem] uppercase tracking-wider px-2 py-1 rounded border transition-all"
                style={{
                  borderColor: active ? opt.color : `${opt.color}33`,
                  color: opt.color,
                  background: active ? `${opt.color}15` : "transparent",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {acidLists.length > 0 ? (
            <select
              value={acidListId}
              onChange={(e) => setAcidListId(e.target.value)}
              className="bg-black/60 border border-white/20 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00bfff]/50"
              aria-label="ACID list"
            >
              <option value="all">All lists</option>
              {acidLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.didCount.toLocaleString()})
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="text"
            placeholder="Search DID or area code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14]/50 w-56"
          />
          <button
            onClick={handleExport}
            className="font-mono text-[0.6rem] font-bold uppercase tracking-wider px-3 py-1.5 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-black/90 z-10">
            <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40 border-b border-white/10">
              <SortHeader onClick={() => handleSort("did")} label={`DID${sortArrow("did")}`} />
              <SortHeader
                onClick={() => handleSort("areaCode")}
                label={`Area Code${sortArrow("areaCode")}`}
              />
              <th className="px-4 py-3">City, State</th>
              <SortHeader
                onClick={() => handleSort("totalDials")}
                label={`Dials${sortArrow("totalDials")}`}
                alignRight
              />
              <SortHeader
                onClick={() => handleSort("dialsPerDay")}
                label={`Dials/Day${sortArrow("dialsPerDay")}`}
                alignRight
              />
              <SortHeader
                onClick={() => handleSort("totalAnswered")}
                label={`Answered${sortArrow("totalAnswered")}`}
                alignRight
              />
              <SortHeader
                onClick={() => handleSort("avgLengthSec")}
                label={`Avg Len${sortArrow("avgLengthSec")}`}
                alignRight
              />
              <SortHeader
                onClick={() => handleSort("lastUsedDate")}
                label={`Last Used${sortArrow("lastUsedDate")}`}
              />
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">In List</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const info = AREA_CODES[r.areaCode];
              return (
                <tr
                  key={r.didId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-sm text-white/80">
                    {fmtDid(r.did)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#00bfff]">
                    {r.areaCode}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-white/60">
                    {info ? `${info.city}, ${info.state}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-white/80 text-right">
                    {r.totalDials.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/70 text-right">
                    {r.dialsPerDay.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/70 text-right">
                    {r.totalAnswered.toLocaleString()} (
                    {(r.answeredPct * 100).toFixed(1)}%)
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/60 text-right">
                    {r.avgLengthSec > 0 ? fmtLength(r.avgLengthSec) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                    {r.lastUsedDate ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="font-mono text-[0.55rem] px-2 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        color: r.bandColor,
                        border: `1px solid ${r.bandColor}40`,
                        background: `${r.bandColor}15`,
                      }}
                    >
                      {r.bandLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">
                    {r.inAcidList ? (
                      <span className="text-[#00bfff]">yes</span>
                    ) : (
                      <span className="text-white/30">no</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-white/10 text-xs font-mono text-white/30">
        {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} DIDs
      </div>
    </div>
  );
}

function SortHeader({
  label,
  onClick,
  alignRight,
}: {
  label: string;
  onClick: () => void;
  alignRight?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer hover:text-[#39ff14] ${
        alignRight ? "text-right" : ""
      }`}
    >
      {label}
    </th>
  );
}
