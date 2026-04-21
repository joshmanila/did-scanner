process.env.CONVOSO_USE_FIXTURES = "true";

import { ConvosoClient } from "../src/lib/convoso/client";

async function main() {
  const client = new ConvosoClient({
    apiUrl: "https://fixtures.local",
    authToken: "fixture-token",
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const end = `${now.toISOString().slice(0, 10)} 23:59:59`;
  const start = `${thirtyDaysAgo.toISOString().slice(0, 10)} 00:00:00`;

  let totalPages = 0;
  let rowCount = 0;
  let inboundCount = 0;
  for await (const page of client.streamCallLogs({
    start_date: start,
    end_date: end,
    pageSize: 500,
  })) {
    totalPages += 1;
    rowCount += page.results.length;
    for (const row of page.results) {
      if ((row.call_type || "").toUpperCase() === "INBOUND") inboundCount += 1;
    }
  }

  console.log(
    JSON.stringify({ totalPages, rowCount, inboundCount }, null, 2)
  );

  if (inboundCount !== 0) {
    console.error("FAIL: inboundCount should be 0");
    process.exit(1);
  }
  if (rowCount === 0) {
    console.error("FAIL: rowCount should be > 0");
    process.exit(1);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
