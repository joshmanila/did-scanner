export type UtilBand = "dormant" | "underused" | "healthy" | "overused";

export interface UtilBandInfo {
  band: UtilBand;
  color: string;
  label: string;
}

const BANDS: Record<UtilBand, UtilBandInfo> = {
  dormant: { band: "dormant", color: "#ff3860", label: "DORMANT" },
  underused: { band: "underused", color: "#ffdd57", label: "UNDERUSED" },
  healthy: { band: "healthy", color: "#39ff14", label: "HEALTHY" },
  overused: { band: "overused", color: "#ff9500", label: "OVERUSED" },
};

export function utilBand(totalDials: number, activeDays: number): UtilBandInfo {
  if (totalDials <= 0) return BANDS.dormant;
  const perDay = activeDays > 0 ? totalDials / activeDays : totalDials;
  if (perDay < 10) return BANDS.underused;
  if (perDay <= 50) return BANDS.healthy;
  return BANDS.overused;
}

export type DialerHealth = "healthy" | "warning" | "error";

export interface DialerHealthInput {
  lastSuccessAt: Date | null;
  lastHourDials: number;
  nyHour: number;
  overCapCount: number;
  contactRate30d: number;
  contactRatePrior7d: number;
}

export function dialerHealth(input: DialerHealthInput): DialerHealth {
  const now = Date.now();
  const lastSuccessMs = input.lastSuccessAt?.getTime() ?? 0;
  const hoursSince = lastSuccessMs
    ? (now - lastSuccessMs) / (60 * 60 * 1000)
    : Number.POSITIVE_INFINITY;
  if (hoursSince > 24) return "error";
  const businessHours = input.nyHour >= 8 && input.nyHour < 20;
  if (businessHours && input.lastHourDials === 0) return "error";

  if (input.overCapCount > 5) return "warning";
  if (input.contactRatePrior7d > 0) {
    const delta = input.contactRatePrior7d - input.contactRate30d;
    const relative = delta / input.contactRatePrior7d;
    if (relative > 0.3) return "warning";
  }
  return "healthy";
}

export const HEALTH_COLORS: Record<DialerHealth, string> = {
  healthy: "#39ff14",
  warning: "#ff9500",
  error: "#ff003c",
};
