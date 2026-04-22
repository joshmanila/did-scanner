// Dashboard status thresholds. Placeholder values — tune against real
// production data once a few weeks of traffic are seeded.

export const UTIL_UNDERUSED_MAX_PER_DAY = 10;
export const UTIL_HEALTHY_MAX_PER_DAY = 50;

export const HEALTH_STALE_SYNC_HOURS = 24;
export const HEALTH_BUSINESS_HOUR_START = 8;
export const HEALTH_BUSINESS_HOUR_END = 20;
export const HEALTH_OVER_CAP_WARN_COUNT = 5;
export const HEALTH_CONTACT_RATE_DROP_WARN = 0.3;

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
  if (perDay < UTIL_UNDERUSED_MAX_PER_DAY) return BANDS.underused;
  if (perDay <= UTIL_HEALTHY_MAX_PER_DAY) return BANDS.healthy;
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
  if (hoursSince > HEALTH_STALE_SYNC_HOURS) return "error";
  const businessHours =
    input.nyHour >= HEALTH_BUSINESS_HOUR_START &&
    input.nyHour < HEALTH_BUSINESS_HOUR_END;
  if (businessHours && input.lastHourDials === 0) return "error";

  if (input.overCapCount > HEALTH_OVER_CAP_WARN_COUNT) return "warning";
  if (input.contactRatePrior7d > 0) {
    const delta = input.contactRatePrior7d - input.contactRate30d;
    const relative = delta / input.contactRatePrior7d;
    if (relative > HEALTH_CONTACT_RATE_DROP_WARN) return "warning";
  }
  return "healthy";
}

export const HEALTH_COLORS: Record<DialerHealth, string> = {
  healthy: "#39ff14",
  warning: "#ff9500",
  error: "#ff003c",
};
