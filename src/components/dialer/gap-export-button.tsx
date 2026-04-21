"use client";

import type { GapAnalysisEntry } from "@/lib/gap-analysis";
import { csvSafeFileName, downloadCsv } from "@/lib/csv-export";

interface Props {
  entries: GapAnalysisEntry[];
  dialerName: string;
}

export default function GapExportButton({ entries, dialerName }: Props) {
  function handleClick() {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `did-scanner-${csvSafeFileName(dialerName)}-gap-analysis-${today}.csv`;
    const rows = entries.map((e) => ({
      area_code: e.areaCode,
      city: e.city,
      state: e.state,
      call_count: e.callCount,
      did_count: e.didCount,
      ratio_pct: (e.ratio * 100).toFixed(2),
      status: e.status,
    }));
    downloadCsv(rows, filename);
  }
  return (
    <button
      onClick={handleClick}
      className="font-mono text-[0.6rem] font-bold uppercase tracking-wider px-3 py-1.5 rounded border border-[#00bfff]/40 text-[#00bfff] hover:bg-[#00bfff]/10"
    >
      Export CSV
    </button>
  );
}
