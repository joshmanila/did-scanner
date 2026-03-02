"use client";

import { useState, useMemo } from "react";
import type { AreaCodeGroup } from "@/lib/types";

interface DIDTableProps {
  groups: AreaCodeGroup[];
}

export default function DIDTable({ groups }: DIDTableProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "areaCode" | "state">(
    "count"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = groups;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.areaCode.includes(q) ||
          g.city.toLowerCase().includes(q) ||
          g.state.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "count") cmp = a.count - b.count;
      else if (sortBy === "areaCode")
        cmp = a.areaCode.localeCompare(b.areaCode);
      else cmp = a.state.localeCompare(b.state);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [groups, search, sortBy, sortDir]);

  const handleSort = (col: "count" | "areaCode" | "state") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortArrow = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "desc" ? " \u25BC" : " \u25B2";
  };

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#39ff14]/20 bg-black/50 backdrop-blur overflow-hidden">
      <div className="p-4 border-b border-[#39ff14]/10 flex items-center justify-between gap-4">
        <div
          className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#39ff14]"
          style={{ textShadow: "0 0 6px rgba(57, 255, 20, 0.6)" }}
        >
          [ DID TABLE ]
        </div>
        <input
          type="text"
          placeholder="Search area code, city, state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-black/60 border border-[#39ff14]/20 rounded px-3 py-1.5 text-xs font-mono text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#39ff14]/50 w-64"
        />
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-black/90 z-10">
            <tr className="font-mono text-[0.65rem] uppercase tracking-wider text-white/40 border-b border-[#39ff14]/10">
              <th
                className="px-4 py-3 cursor-pointer hover:text-[#39ff14]/60"
                onClick={() => handleSort("areaCode")}
              >
                Area Code{sortArrow("areaCode")}
              </th>
              <th className="px-4 py-3">City</th>
              <th
                className="px-4 py-3 cursor-pointer hover:text-[#39ff14]/60"
                onClick={() => handleSort("state")}
              >
                State{sortArrow("state")}
              </th>
              <th
                className="px-4 py-3 cursor-pointer hover:text-[#39ff14]/60 text-right"
                onClick={() => handleSort("count")}
              >
                DIDs{sortArrow("count")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((group) => (
              <>
                <tr
                  key={group.areaCode}
                  className="border-b border-white/5 hover:bg-[#39ff14]/5 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpanded(
                      expanded === group.areaCode ? null : group.areaCode
                    )
                  }
                >
                  <td className="px-4 py-2.5 font-mono text-sm text-[#39ff14]/80">
                    ({group.areaCode})
                  </td>
                  <td className="px-4 py-2.5 text-sm text-white/70">
                    {group.city}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-white/70">
                    {group.state}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#39ff14]/80 font-mono text-right font-bold">
                    {group.count}
                  </td>
                </tr>
                {expanded === group.areaCode && (
                  <tr key={`${group.areaCode}-expanded`}>
                    <td
                      colSpan={4}
                      className="px-4 py-3 bg-[#39ff14]/5 border-b border-[#39ff14]/10"
                    >
                      <div className="font-mono text-xs text-white/50 flex flex-wrap gap-2">
                        {group.dids.map((did, i) => (
                          <span
                            key={i}
                            className="bg-black/40 px-2 py-0.5 rounded border border-[#39ff14]/10"
                          >
                            {did.replace(
                              /(\d{3})(\d{3})(\d{4})/,
                              "($1) $2-$3"
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-[#39ff14]/10 text-xs font-mono text-white/30">
        {filtered.length} area code{filtered.length !== 1 ? "s" : ""} shown
      </div>
    </div>
  );
}
