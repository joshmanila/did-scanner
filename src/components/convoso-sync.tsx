"use client";

import { useState } from "react";

interface ConvosoSyncProps {
  onSync: (dateFrom: string, dateTo: string) => Promise<void>;
  isSyncing: boolean;
  lastSyncInfo?: { totalCalls: number; dateFrom: string; dateTo: string } | null;
}

export default function ConvosoSync({
  onSync,
  isSyncing,
  lastSyncInfo,
}: ConvosoSyncProps) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [dateFrom, setDateFrom] = useState(
    thirtyDaysAgo.toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState(now.toISOString().split("T")[0]);

  return (
    <div className="rounded-lg border border-[#00bfff]/20 bg-black/50 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div
            className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
            style={{ textShadow: "0 0 6px rgba(0, 191, 255, 0.6)" }}
          >
            [ CONVOSO CALL DATA ]
          </div>
          {lastSyncInfo && (
            <p className="font-mono text-xs text-white/40">
              {lastSyncInfo.totalCalls.toLocaleString()} calls synced (
              {lastSyncInfo.dateFrom.split(" ")[0]} to{" "}
              {lastSyncInfo.dateTo.split(" ")[0]})
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={isSyncing}
              className="bg-black/60 border border-[#00bfff]/20 rounded px-2 py-1 text-xs font-mono text-white/80 focus:outline-none focus:border-[#00bfff]/50 disabled:opacity-50"
            />
            <span className="text-white/30 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={isSyncing}
              className="bg-black/60 border border-[#00bfff]/20 rounded px-2 py-1 text-xs font-mono text-white/80 focus:outline-none focus:border-[#00bfff]/50 disabled:opacity-50"
            />
          </div>

          <button
            onClick={() =>
              onSync(dateFrom + " 00:00:00", dateTo + " 23:59:59")
            }
            disabled={isSyncing}
            className={`
              font-mono text-xs font-bold tracking-wider uppercase px-4 py-2 rounded border transition-all
              ${
                isSyncing
                  ? "border-[#00bfff]/20 text-[#00bfff]/40 cursor-not-allowed"
                  : "border-[#00bfff]/40 text-[#00bfff] hover:bg-[#00bfff]/10 hover:border-[#00bfff]/60 hover:shadow-[0_0_20px_rgba(0,191,255,0.2)]"
              }
            `}
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-[#00bfff]/30 border-t-[#00bfff] rounded-full animate-spin" />
                Syncing...
              </span>
            ) : lastSyncInfo ? (
              "Re-Sync"
            ) : (
              "Sync with Convoso"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
