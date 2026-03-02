import { NextResponse } from "next/server";
import { createConvosoClient } from "@/lib/convoso/client";

export const maxDuration = 60;

const PAGE_SIZE = 1000;
const PARALLEL_PAGES = 3;
const MAX_PAGES = 50;

export async function GET(request: Request) {
  const client = createConvosoClient();
  if (!client) {
    return NextResponse.json(
      { error: "Convoso API not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Default to last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFrom =
    searchParams.get("dateFrom") ||
    thirtyDaysAgo.toISOString().split("T")[0] + " 00:00:00";
  const dateTo =
    searchParams.get("dateTo") ||
    now.toISOString().split("T")[0] + " 23:59:59";

  const distribution: Record<string, number> = {};
  let totalCalls = 0;
  let offset = 0;
  let pagesProcessed = 0;
  let hasMore = true;

  try {
    while (hasMore && pagesProcessed < MAX_PAGES) {
      // Fetch up to PARALLEL_PAGES in parallel
      const pagesToFetch = Math.min(
        PARALLEL_PAGES,
        MAX_PAGES - pagesProcessed
      );
      const promises = [];

      for (let i = 0; i < pagesToFetch; i++) {
        const currentOffset = offset + i * PAGE_SIZE;
        promises.push(
          client
            .getCallLogs({
              start_date: dateFrom,
              end_date: dateTo,
              limit: String(PAGE_SIZE),
              offset: String(currentOffset),
            })
            .catch((err) => {
              console.error(
                `Error fetching page at offset ${currentOffset}:`,
                err
              );
              return null;
            })
        );
      }

      const results = await Promise.all(promises);

      let anyResults = false;
      for (const result of results) {
        if (!result || !result.results || result.results.length === 0) continue;
        anyResults = true;

        for (const log of result.results) {
          // Extract area code from phone_number
          const phone = (log.phone_number || "").replace(/\D/g, "");
          let areaCode: string;
          if (phone.length === 11 && phone.startsWith("1")) {
            areaCode = phone.slice(1, 4);
          } else if (phone.length >= 10) {
            areaCode = phone.slice(0, 3);
          } else {
            continue; // Skip invalid phone numbers
          }

          distribution[areaCode] = (distribution[areaCode] || 0) + 1;
          totalCalls++;
        }
      }

      if (!anyResults) {
        hasMore = false;
      } else {
        offset += pagesToFetch * PAGE_SIZE;
        pagesProcessed += pagesToFetch;

        // Check if we got fewer results than requested on the last page
        const lastResult = results[results.length - 1];
        if (
          lastResult &&
          lastResult.results &&
          lastResult.results.length < PAGE_SIZE
        ) {
          hasMore = false;
        }
      }
    }

    return NextResponse.json({
      distribution,
      totalCalls,
      dateFrom,
      dateTo,
      pagesProcessed,
    });
  } catch (error) {
    console.error("Call distribution error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch call distribution",
      },
      { status: 500 }
    );
  }
}
