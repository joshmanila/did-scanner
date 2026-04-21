"use client";

import type { AreaCodeGroup } from "@/lib/types";
import { csvSafeFileName, downloadCsv } from "@/lib/csv-export";

interface Props {
  groups: AreaCodeGroup[];
  dialerName: string;
}

export default function AreaCodeExportButton({ groups, dialerName }: Props) {
  function handleClick() {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `did-scanner-${csvSafeFileName(dialerName)}-area-codes-${today}.csv`;
    const rows = groups.map((g) => ({
      area_code: g.areaCode,
      city: g.city,
      state: g.state,
      country: g.country,
      dids: g.count,
    }));
    downloadCsv(rows, filename);
  }
  return (
    <button
      onClick={handleClick}
      className="font-mono text-[0.6rem] font-bold uppercase tracking-wider px-3 py-1.5 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10"
    >
      Export CSV
    </button>
  );
}
