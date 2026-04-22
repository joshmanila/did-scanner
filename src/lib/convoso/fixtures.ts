import type { ConvosoCallLog, ConvosoLogResponse } from "./types";

const AREA_CODES = [
  "212", "213", "312", "404", "415", "480", "503", "512", "602", "617",
  "646", "702", "703", "714", "773", "786", "801", "813", "832", "857",
  "917", "919", "972", "305", "407", "512", "303", "415", "720", "619",
  "210", "210", "713", "213", "619",
];

const UNIQUE_AREA_CODES = Array.from(new Set(AREA_CODES));

const STATUSES = [
  "ANSWERED",
  "NO_ANSWER",
  "BUSY",
  "VOICEMAIL",
  "HANGUP",
  "FAILED",
];

const CALL_TYPES = ["OUTBOUND", "MANUAL", "INBOUND"];

const CAMPAIGNS: Array<{ id: string; name: string }> = [
  { id: "c-1", name: "Alpha Campaign" },
  { id: "c-2", name: "Bravo Campaign" },
  { id: "c-3", name: "Charlie Campaign" },
];

const PAGE_SIZE = 500;
const TOTAL_ROWS = 2200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface FixtureSeed {
  rng: () => number;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeed(): FixtureSeed {
  return { rng: mulberry32(0xDEADBEEF) };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function formatCallDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1, 2);
  const day = pad(d.getUTCDate(), 2);
  const hh = pad(d.getUTCHours(), 2);
  const mm = pad(d.getUTCMinutes(), 2);
  const ss = pad(d.getUTCSeconds(), 2);
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function buildDid(areaCode: string, index: number): string {
  const mid = pad((200 + (index % 800)) % 1000, 3);
  const last = pad((1000 + (index * 37) % 9000), 4);
  return `${areaCode}${mid}${last}`;
}

function buildPhone(areaCode: string, index: number): string {
  const mid = pad((321 + (index * 13) % 800), 3);
  const last = pad((1234 + (index * 91) % 8765), 4);
  return `1${areaCode}${mid}${last}`;
}

function buildLogs(): ConvosoCallLog[] {
  const seed = makeSeed();
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
    0,
    0
  );

  const logs: ConvosoCallLog[] = [];
  for (let i = 0; i < TOTAL_ROWS; i++) {
    const areaCode = UNIQUE_AREA_CODES[i % UNIQUE_AREA_CODES.length];
    const didIndex = i % (UNIQUE_AREA_CODES.length * 2);
    const didAreaCode = UNIQUE_AREA_CODES[didIndex % UNIQUE_AREA_CODES.length];
    const number_dialed = buildDid(didAreaCode, didIndex);
    const phone_number = buildPhone(areaCode, i);
    const daysBack = Math.floor(seed.rng() * 30);
    const hourOffset = Math.floor(seed.rng() * 24);
    const minuteOffset = Math.floor(seed.rng() * 60);
    const callDateMs =
      nowUtc -
      daysBack * MS_PER_DAY +
      hourOffset * 60 * 60 * 1000 +
      minuteOffset * 60 * 1000;
    const callDate = new Date(callDateMs);

    const callType = pick(seed.rng, CALL_TYPES);
    const status = pick(seed.rng, STATUSES);
    const answered = status === "ANSWERED" || status === "VOICEMAIL";
    const lengthSec = answered
      ? Math.floor(seed.rng() * 600) + 5
      : 0;
    const campaign = pick(seed.rng, CAMPAIGNS);

    logs.push({
      id: `fx-${i}`,
      lead_id: `lead-${i}`,
      list_id: "list-1",
      campaign_id: campaign.id,
      campaign: campaign.name,
      user: "fixture-user",
      user_id: "fx-user-1",
      phone_number,
      number_dialed,
      caller_id_displayed: null,
      first_name: null,
      last_name: null,
      status,
      status_name: status,
      call_length: lengthSec.toString(),
      call_date: formatCallDate(callDate),
      agent_comment: null,
      term_reason: "NORMAL",
      call_type: callType,
    });
  }
  return logs;
}

const FIXTURE_LOGS: ConvosoCallLog[] = buildLogs();

export function getFixtureCallLogs(): ConvosoLogResponse[] {
  const pages: ConvosoLogResponse[] = [];
  for (let offset = 0; offset < FIXTURE_LOGS.length; offset += PAGE_SIZE) {
    const slice = FIXTURE_LOGS.slice(offset, offset + PAGE_SIZE);
    pages.push({
      offset,
      limit: PAGE_SIZE,
      total_found: FIXTURE_LOGS.length,
      entries: slice.length,
      results: slice,
    });
  }
  return pages;
}

export function getFixtureLogsWithinWindow(
  fromMs: number,
  toMs: number
): ConvosoCallLog[] {
  return FIXTURE_LOGS.filter((log) => {
    const t = parseFixtureDate(log.call_date);
    return t >= fromMs && t <= toMs;
  });
}

function parseFixtureDate(s: string): number {
  const [datePart, timePart] = s.split(" ");
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));
  const [hh, mm, ss] = (timePart || "00:00:00")
    .split(":")
    .map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d, hh, mm, ss);
}
