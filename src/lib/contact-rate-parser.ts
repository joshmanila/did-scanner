export interface ContactRateRow {
  did: string;
  calls: number;
  contacts: number;
}

export interface ContactRateParseResult {
  rows: ContactRateRow[];
  totalCalls: number;
  totalContacts: number;
  skipped: number;
  errors: string[];
}

function cleanDid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/[eE][+-]?\d/.test(trimmed)) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

function parseIntStripped(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const stripped = raw.replace(/,/g, "").trim();
  if (stripped === "") return 0;
  const n = parseInt(stripped, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function splitRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  return line.split(/\s{2,}/);
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseContactRateCsv(input: string): ContactRateParseResult {
  const errors: string[] = [];
  const raw = input.replace(/﻿/g, "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      totalCalls: 0,
      totalContacts: 0,
      skipped: 0,
      errors: ["File has no data rows."],
    };
  }

  const byDid = new Map<string, { calls: number; contacts: number }>();
  let skipped = 0;
  let didIdx = -1;
  let callsIdx = -1;
  let contactsIdx = -1;
  let headerSeen = false;

  for (const line of lines) {
    const cells = splitRow(line).map((c) => c.trim());
    const firstNorm = normalizeHeader(cells[0] ?? "");
    if (!headerSeen || firstNorm === "did") {
      if (firstNorm === "did") {
        headerSeen = true;
        didIdx = -1;
        callsIdx = -1;
        contactsIdx = -1;
        for (let i = 0; i < cells.length; i++) {
          const h = normalizeHeader(cells[i]);
          if (h === "did") didIdx = i;
          else if (h === "calls") callsIdx = i;
          else if (h === "contacts") contactsIdx = i;
        }
        if (didIdx === -1 || callsIdx === -1 || contactsIdx === -1) {
          errors.push(
            `Header row missing required columns (need DID, Calls, Contacts). Saw: ${cells.join(", ")}`
          );
          headerSeen = false;
        }
        continue;
      }
      if (!headerSeen) {
        continue;
      }
    }

    if (didIdx === -1) continue;

    const did = cleanDid(cells[didIdx]);
    if (!did) {
      skipped += 1;
      continue;
    }
    const calls = parseIntStripped(cells[callsIdx]);
    const contacts = parseIntStripped(cells[contactsIdx]);
    if (calls === null || contacts === null) {
      skipped += 1;
      continue;
    }

    const existing = byDid.get(did);
    if (existing) {
      existing.calls += calls;
      existing.contacts += contacts;
    } else {
      byDid.set(did, { calls, contacts });
    }
  }

  let totalCalls = 0;
  let totalContacts = 0;
  const rows: ContactRateRow[] = [];
  for (const [did, v] of byDid) {
    rows.push({ did, calls: v.calls, contacts: v.contacts });
    totalCalls += v.calls;
    totalContacts += v.contacts;
  }

  if (!headerSeen) {
    errors.push(
      "No header row with DID / Calls / Contacts columns was found."
    );
  }

  return { rows, totalCalls, totalContacts, skipped, errors };
}
