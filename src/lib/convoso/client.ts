import { decryptToken } from "@/lib/crypto";
import type { Dialer } from "@/db/schema";
import type {
  ConvosoCallLog,
  ConvosoClientConfig,
  ConvosoLogResponse,
} from "./types";
import { getFixtureCallLogs } from "./fixtures";

function shouldUseFixtures(): boolean {
  return process.env.CONVOSO_USE_FIXTURES === "true";
}

let loggedFirstRowKeys = false;
function logFirstRowFieldsOnce(row: unknown): void {
  if (loggedFirstRowKeys) return;
  loggedFirstRowKeys = true;
  try {
    const keys = Object.keys(row as Record<string, unknown>).sort();
    console.log("[convoso] call log response keys:", keys.join(","));
  } catch {
    // swallow — diagnostic only
  }
}

function isInboundCallType(callType: string | null | undefined): boolean {
  if (!callType) return false;
  return callType.trim().toUpperCase() === "INBOUND";
}

function filterOutboundOnly(
  logs: ConvosoCallLog[]
): ConvosoCallLog[] {
  const filtered: ConvosoCallLog[] = [];
  for (const log of logs) {
    if (isInboundCallType(log.call_type)) continue;
    filtered.push(log);
  }
  return filtered;
}

function assertNoInbound(logs: ConvosoCallLog[]): void {
  for (const log of logs) {
    if (isInboundCallType(log.call_type)) {
      throw new Error(
        "Outbound-only contract violated: inbound call_type leaked past the Convoso client layer."
      );
    }
  }
}

export class ConvosoClient {
  private config: ConvosoClientConfig;

  constructor(config: ConvosoClientConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const body = new URLSearchParams({
      auth_token: this.config.authToken,
      ...params,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Convoso API error: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(
        `Convoso API error: ${json.code} ${json.text || json.error || "Unknown"}`
      );
    }

    return (json.data ?? json) as T;
  }

  async getCallLogs(params: {
    start_date: string;
    end_date: string;
    limit: string;
    offset: string;
  }): Promise<ConvosoLogResponse & { rawEntries: number }> {
    if (shouldUseFixtures()) {
      const page = getFixturePage(params);
      return { ...page, rawEntries: page.results.length };
    }
    const raw = await this.request<ConvosoLogResponse>(
      "/log/retrieve",
      params as Record<string, string>
    );
    const rawEntries = raw.results?.length ?? 0;
    if (rawEntries > 0) {
      logFirstRowFieldsOnce(raw.results![0]);
    }
    const results = filterOutboundOnly(raw.results ?? []);
    assertNoInbound(results);
    return {
      ...raw,
      entries: results.length,
      rawEntries,
      results,
    };
  }

  async *streamCallLogs(params: {
    start_date: string;
    end_date: string;
    pageSize?: number;
  }): AsyncGenerator<ConvosoLogResponse & { rawEntries: number }, void, void> {
    const limit = params.pageSize ?? 1000;
    let offset = 0;
    while (true) {
      const page = await this.getCallLogs({
        start_date: params.start_date,
        end_date: params.end_date,
        limit: String(limit),
        offset: String(offset),
      });
      yield page;
      if (page.rawEntries === 0) return;
      if (page.rawEntries < limit) return;
      offset += limit;
    }
  }
}

function getFixturePage(params: {
  start_date: string;
  end_date: string;
  limit: string;
  offset: string;
}): ConvosoLogResponse {
  const pages = getFixtureCallLogs();
  const limit = parseInt(params.limit, 10) || 1000;
  const offset = parseInt(params.offset, 10) || 0;

  const allResults: ConvosoCallLog[] = [];
  for (const page of pages) {
    allResults.push(...page.results);
  }

  const fromMs = parseConvosoDate(params.start_date);
  const toMs = parseConvosoDate(params.end_date);
  const windowed = allResults.filter((log) => {
    const t = parseConvosoDate(log.call_date);
    return t >= fromMs && t <= toMs;
  });

  const outbound = filterOutboundOnly(windowed);
  assertNoInbound(outbound);

  const slice = outbound.slice(offset, offset + limit);
  return {
    offset,
    limit,
    total_found: outbound.length,
    entries: slice.length,
    results: slice,
  };
}

function parseConvosoDate(s: string): number {
  const [datePart, timePart = "00:00:00"] = s.split(" ");
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));
  const [hh, mm, ss] = timePart.split(":").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d, hh, mm, ss);
}

export function createConvosoClient(): ConvosoClient | null {
  if (shouldUseFixtures()) {
    return new ConvosoClient({
      apiUrl: "https://fixtures.local",
      authToken: "fixture-token",
    });
  }
  const apiUrl = process.env.CONVOSO_API_URL;
  const authToken = process.env.CONVOSO_AUTH_TOKEN;

  if (!apiUrl || !authToken) {
    return null;
  }

  return new ConvosoClient({ apiUrl, authToken });
}

export function createConvosoClientForDialer(dialer: Dialer): ConvosoClient {
  if (shouldUseFixtures()) {
    return new ConvosoClient({
      apiUrl: dialer.convosoApiUrl || "https://fixtures.local",
      authToken: "fixture-token",
    });
  }
  const token = decryptToken(dialer.convosoAuthTokenEncrypted);
  return new ConvosoClient({
    apiUrl: dialer.convosoApiUrl,
    authToken: token,
  });
}
