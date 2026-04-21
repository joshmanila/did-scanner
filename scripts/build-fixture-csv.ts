process.env.CONVOSO_USE_FIXTURES = "true";

import { writeFileSync } from "node:fs";
import { getFixtureCallLogs } from "../src/lib/convoso/fixtures";

function formatDidForCsv(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

const pages = getFixtureCallLogs();
const allDids = new Set<string>();
for (const page of pages) {
  for (const row of page.results) {
    if (row.number_dialed) allDids.add(row.number_dialed);
  }
}
const didArray = Array.from(allDids);

const extraDids: string[] = [];
const extraAreaCodes = [
  "201", "202", "206", "207", "208", "209", "301", "302",
  "314", "316", "317", "318", "319", "402", "405", "406",
];
const targetTotal = 200;
const neededExtras = Math.max(0, targetTotal - didArray.length);
for (let i = 0; i < neededExtras; i++) {
  const ac = extraAreaCodes[i % extraAreaCodes.length];
  extraDids.push(`${ac}${String(5550000 + i).padStart(7, "0").slice(0, 7)}`);
}

const rows = [...didArray, ...extraDids];

const header = "Caller ID,Lead ID,List Name";
const lines = [header];
rows.forEach((did, idx) => {
  lines.push(`${formatDidForCsv(did)},L${1000 + idx},Sample List`);
});

writeFileSync("docs/fixtures/sample-acid-list.csv", lines.join("\n") + "\n");
console.log(`Wrote ${rows.length} rows to docs/fixtures/sample-acid-list.csv`);
