import areaCodesData from "./area-codes.json";
import type { AreaCodeLookup, AreaCodeGroup } from "./types";

const areaCodes: AreaCodeLookup = areaCodesData as AreaCodeLookup;

export type CoverageStatus = "no-coverage" | "low-coverage" | "good-coverage";

export interface GapAnalysisEntry {
  areaCode: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  callCount: number;
  didCount: number;
  ratio: number;
  status: CoverageStatus;
}

export interface GapAnalysisResult {
  entries: GapAnalysisEntry[];
  summary: {
    noCoverage: number;
    lowCoverage: number;
    goodCoverage: number;
    totalCallsNoCoverage: number;
    totalCallsLowCoverage: number;
    totalCallsGoodCoverage: number;
  };
}

export function computeGapAnalysis(
  callDistribution: Record<string, number>,
  didGroups: AreaCodeGroup[]
): GapAnalysisResult {
  // Build lookup of DID counts by area code
  const didCounts: Record<string, number> = {};
  for (const group of didGroups) {
    didCounts[group.areaCode] = group.count;
  }

  const entries: GapAnalysisEntry[] = [];

  for (const [areaCode, callCount] of Object.entries(callDistribution)) {
    const didCount = didCounts[areaCode] || 0;
    const ratio = callCount > 0 ? didCount / callCount : 0;

    let status: CoverageStatus;
    if (didCount === 0) {
      status = "no-coverage";
    } else if (ratio < 0.02) {
      status = "low-coverage";
    } else {
      status = "good-coverage";
    }

    // Look up location from area codes data
    const info = areaCodes[areaCode];
    entries.push({
      areaCode,
      city: info?.city ?? "Unknown",
      state: info?.state ?? "Unknown",
      lat: info?.lat ?? 39.8283,
      lng: info?.lng ?? -98.5795,
      callCount,
      didCount,
      ratio,
      status,
    });
  }

  // Sort by call volume descending (biggest gaps = highest priority)
  entries.sort((a, b) => b.callCount - a.callCount);

  const summary = {
    noCoverage: 0,
    lowCoverage: 0,
    goodCoverage: 0,
    totalCallsNoCoverage: 0,
    totalCallsLowCoverage: 0,
    totalCallsGoodCoverage: 0,
  };

  for (const entry of entries) {
    if (entry.status === "no-coverage") {
      summary.noCoverage++;
      summary.totalCallsNoCoverage += entry.callCount;
    } else if (entry.status === "low-coverage") {
      summary.lowCoverage++;
      summary.totalCallsLowCoverage += entry.callCount;
    } else {
      summary.goodCoverage++;
      summary.totalCallsGoodCoverage += entry.callCount;
    }
  }

  return { entries, summary };
}
