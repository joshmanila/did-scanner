"use client";

import type { GapAnalysisResult } from "@/lib/gap-analysis";

interface GapStatsCardsProps {
  result: GapAnalysisResult;
  totalCalls: number;
}

export default function GapStatsCards({ result, totalCalls }: GapStatsCardsProps) {
  const { summary } = result;

  const cards = [
    {
      label: "NO COVERAGE",
      value: summary.noCoverage,
      subtext: `${summary.totalCallsNoCoverage.toLocaleString()} calls`,
      color: "#ff003c",
    },
    {
      label: "LOW COVERAGE",
      value: summary.lowCoverage,
      subtext: `${summary.totalCallsLowCoverage.toLocaleString()} calls`,
      color: "#ffdd00",
    },
    {
      label: "GOOD COVERAGE",
      value: summary.goodCoverage,
      subtext: `${summary.totalCallsGoodCoverage.toLocaleString()} calls`,
      color: "#39ff14",
    },
    {
      label: "TOTAL CALLS",
      value: totalCalls.toLocaleString(),
      subtext: `${result.entries.length} area codes`,
      color: "#00bfff",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border bg-black/50 p-4 text-center backdrop-blur"
          style={{
            borderColor: `${card.color}33`,
            boxShadow: `0 0 15px ${card.color}15`,
          }}
        >
          <div
            className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase mb-2"
            style={{
              color: card.color,
              textShadow: `0 0 6px ${card.color}99`,
            }}
          >
            [ {card.label} ]
          </div>
          <div
            className="font-mono text-2xl font-bold"
            style={{
              color: card.color,
              textShadow: `0 0 10px ${card.color}66`,
            }}
          >
            {card.value}
          </div>
          <div className="font-mono text-[0.6rem] text-white/40 mt-1">
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}
