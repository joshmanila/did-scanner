"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import CSVUpload from "@/components/csv-upload";
import DIDTable from "@/components/did-table";
import StatsCards from "@/components/stats-cards";
import ConvosoSync from "@/components/convoso-sync";
import GapStatsCards from "@/components/gap-stats-cards";
import GapAnalysisTable from "@/components/gap-analysis-table";
import { parseCSV, groupByAreaCode, computeStats } from "@/lib/parse-dids";
import { computeGapAnalysis } from "@/lib/gap-analysis";
import type { AreaCodeGroup, SummaryStats } from "@/lib/types";
import type { GapAnalysisResult } from "@/lib/gap-analysis";

// Dynamic import for Leaflet map (no SSR)
const DIDMap = dynamic(() => import("@/components/did-map"), { ssr: false });

export default function Home() {
  const [groups, setGroups] = useState<AreaCodeGroup[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gap analysis state
  const [callDistribution, setCallDistribution] = useState<Record<
    string,
    number
  > | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(
    null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{
    totalCalls: number;
    dateFrom: string;
    dateTo: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"dids" | "gap-analysis">("dids");

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

  const handleSync = useCallback(
    async (dateFrom: string, dateTo: string) => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const params = new URLSearchParams({ dateFrom, dateTo });
        const res = await fetch(`/api/convoso/call-distribution?${params}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setCallDistribution(data.distribution);
        setSyncInfo({
          totalCalls: data.totalCalls,
          dateFrom: data.dateFrom,
          dateTo: data.dateTo,
        });

        // Auto-compute gap analysis if we have DID data
        if (groups.length > 0) {
          const result = computeGapAnalysis(data.distribution, groups);
          setGapAnalysis(result);
          setViewMode("gap-analysis");
        }
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : "Failed to sync call data"
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [groups]
  );

  // Auto-recompute gap analysis when CSV is re-uploaded while distribution is cached
  useEffect(() => {
    if (callDistribution && groups.length > 0) {
      const result = computeGapAnalysis(callDistribution, groups);
      setGapAnalysis(result);
    }
  }, [callDistribution, groups]);

  const hasData = groups.length > 0;
  const hasGapData = !!gapAnalysis;

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

        {/* Convoso Sync — visible after CSV upload */}
        {hasData && (
          <section>
            <ConvosoSync
              onSync={handleSync}
              isSyncing={isSyncing}
              lastSyncInfo={syncInfo}
            />
            {syncError && (
              <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
                <p className="font-mono text-xs text-red-400">{syncError}</p>
              </div>
            )}
          </section>
        )}

        {/* View Toggle — visible when gap analysis data exists */}
        {hasData && hasGapData && (
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
              {(
                [
                  { key: "dids", label: "DID Overview" },
                  { key: "gap-analysis", label: "Gap Analysis" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setViewMode(tab.key)}
                  className={`
                    font-mono text-xs font-bold tracking-wider uppercase px-5 py-2.5 transition-all
                    ${
                      viewMode === tab.key
                        ? tab.key === "gap-analysis"
                          ? "bg-[#00bfff]/15 text-[#00bfff] shadow-[inset_0_-2px_0_#00bfff]"
                          : "bg-[#39ff14]/15 text-[#39ff14] shadow-[inset_0_-2px_0_#39ff14]"
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DID Overview Mode */}
        {viewMode === "dids" && (
          <>
            {/* Stats */}
            {stats && (
              <section>
                <StatsCards stats={stats} />
              </section>
            )}

            {/* Map */}
            {hasData && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#39ff14]"
                    style={{
                      textShadow: "0 0 6px rgba(57, 255, 20, 0.6)",
                    }}
                  >
                    [ GEOGRAPHIC DISTRIBUTION ]
                  </div>
                  <div className="flex-1 hud-divider" />
                </div>
                <DIDMap groups={groups} />
              </section>
            )}

            {/* Table */}
            {hasData && (
              <section>
                <DIDTable groups={groups} />
              </section>
            )}
          </>
        )}

        {/* Gap Analysis Mode */}
        {viewMode === "gap-analysis" && gapAnalysis && syncInfo && (
          <>
            {/* Gap Stats Cards */}
            <section>
              <GapStatsCards
                result={gapAnalysis}
                totalCalls={syncInfo.totalCalls}
              />
            </section>

            {/* Gap Map */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
                  style={{
                    textShadow: "0 0 6px rgba(0, 191, 255, 0.6)",
                  }}
                >
                  [ COVERAGE MAP ]
                </div>
                <div className="flex-1 hud-divider" />
              </div>
              <DIDMap groups={groups} gapAnalysis={gapAnalysis} />
            </section>

            {/* Gap Table */}
            <section>
              <GapAnalysisTable entries={gapAnalysis.entries} />
            </section>
          </>
        )}

        {/* Empty state */}
        {!isLoading && !hasData && !error && (
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
