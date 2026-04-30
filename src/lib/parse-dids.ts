import Papa from "papaparse";
import areaCodesData from "./area-codes.json";
import type {
  AreaCodeLookup,
  ParsedDID,
  AreaCodeGroup,
  SummaryStats,
} from "./types";

const areaCodes: AreaCodeLookup = areaCodesData as AreaCodeLookup;

function cleanPhoneNumber(raw: string): string {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, "");
  // Remove leading 1 (US/CA country code) if 11 digits
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function extractAreaCode(cleaned: string): string {
  return cleaned.slice(0, 3);
}

export function parseCSV(
  file: File
): Promise<{ dids: ParsedDID[]; unmapped: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const dids: ParsedDID[] = [];
        const unmapped: string[] = [];

        // Find the Caller ID column (case-insensitive, flexible matching)
        const headers = results.meta.fields || [];
        const callerIdCol = headers.find(
          (h) =>
            h.toLowerCase().replace(/[^a-z]/g, "").includes("callerid") ||
            h.toLowerCase().replace(/[^a-z]/g, "").includes("did") ||
            h.toLowerCase().replace(/[^a-z]/g, "").includes("phonenumber") ||
            h.toLowerCase().replace(/[^a-z]/g, "").includes("phone")
        );

        if (!callerIdCol) {
          reject(
            new Error(
              `Could not find a "Caller ID" column. Found columns: ${headers.join(", ")}`
            )
          );
          return;
        }

        for (const row of results.data as Record<string, string>[]) {
          const raw = (row[callerIdCol] || "").trim();
          if (!raw) continue;

          const cleaned = cleanPhoneNumber(raw);
          if (cleaned.length < 10) continue;

          const areaCode = extractAreaCode(cleaned);
          const info = areaCodes[areaCode];

          if (info) {
            dids.push({
              raw,
              cleaned,
              areaCode,
              city: info.city,
              state: info.state,
              country: info.country,
              lat: info.lat,
              lng: info.lng,
            });
          } else {
            unmapped.push(raw);
            dids.push({
              raw,
              cleaned,
              areaCode,
              city: "Unknown",
              state: "Unknown",
              country: "Unknown",
              lat: 0,
              lng: 0,
            });
          }
        }

        resolve({ dids, unmapped });
      },
      error(err: Error) {
        reject(err);
      },
    });
  });
}

export function groupByAreaCode(dids: ParsedDID[]): AreaCodeGroup[] {
  const groups: Record<string, AreaCodeGroup> = {};

  for (const did of dids) {
    if (!groups[did.areaCode]) {
      groups[did.areaCode] = {
        areaCode: did.areaCode,
        city: did.city,
        state: did.state,
        country: did.country,
        lat: did.lat,
        lng: did.lng,
        count: 0,
        dids: [],
      };
    }
    groups[did.areaCode].count++;
    groups[did.areaCode].dids.push(did.cleaned);
  }

  return Object.values(groups).sort((a, b) => b.count - a.count);
}

export function computeStats(
  dids: ParsedDID[],
  unmappedCount: number
): SummaryStats {
  const stateBreakdown: Record<string, number> = {};

  for (const did of dids) {
    const key = did.state;
    stateBreakdown[key] = (stateBreakdown[key] || 0) + 1;
  }

  const uniqueAreaCodes = new Set(dids.map((d) => d.areaCode)).size;

  return {
    totalDIDs: dids.length + unmappedCount,
    uniqueAreaCodes,
    stateBreakdown,
    unmappedCount,
  };
}
