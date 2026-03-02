"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import CSVUpload from "@/components/csv-upload";
import DIDTable from "@/components/did-table";
import StatsCards from "@/components/stats-cards";
import { parseCSV, groupByAreaCode, computeStats } from "@/lib/parse-dids";
import type { AreaCodeGroup, SummaryStats } from "@/lib/types";

// Dynamic import for Leaflet map (no SSR)
const DIDMap = dynamic(() => import("@/components/did-map"), { ssr: false });

export default function Home() {
  const [groups, setGroups] = useState<AreaCodeGroup[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const { dids, unmapped } = await parseCSV(file);
      const grouped = groupByAreaCode(dids);
      const summary = computeStats(dids, unmapped.length);

      setGroups(grouped);
      setStats(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
      setGroups([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen hud-grid-bg hud-scanlines">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="font-mono text-3xl font-bold tracking-wider text-[#39ff14] text-glow-green animate-neon-flicker">
            DID SCANNER
          </h1>
          <div className="hud-divider max-w-md mx-auto" />
          <p className="font-mono text-xs text-white/40 tracking-widest uppercase">
            Convoso ACID List Area Code Mapper
          </p>
        </header>

        {/* Upload */}
        <section>
          <CSVUpload onFileSelected={handleFile} isLoading={isLoading} />
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <section>
            <StatsCards stats={stats} />
          </section>
        )}

        {/* Map */}
        {groups.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#39ff14]"
                style={{ textShadow: "0 0 6px rgba(57, 255, 20, 0.6)" }}
              >
                [ GEOGRAPHIC DISTRIBUTION ]
              </div>
              <div className="flex-1 hud-divider" />
            </div>
            <DIDMap groups={groups} />
          </section>
        )}

        {/* Table */}
        {groups.length > 0 && (
          <section>
            <DIDTable groups={groups} />
          </section>
        )}

        {/* Empty state */}
        {!isLoading && groups.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="font-mono text-white/20 text-sm">
              Upload a CSV to see DID locations on the map
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
