const NY_TIME_ZONE = "America/New_York";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function nyDateString(date: Date): string {
  return dateFormatter.format(date);
}

export function nyTodayString(): string {
  return nyDateString(new Date());
}

export function nyDateStringDaysAgo(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return nyDateString(now);
}

export function parseConvosoDateAsUtcMs(s: string): number {
  const [datePart, timePart = "00:00:00"] = s.split(" ");
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));
  const [hh, mm, ss] = timePart.split(":").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d, hh, mm, ss);
}

export function nyHour(date: Date): number {
  const parts = partsFormatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
}

export function formatConvosoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}
