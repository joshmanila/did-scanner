"use client";

import type { SummaryStats } from "@/lib/types";

interface StatsCardsProps {
  stats: SummaryStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  // Top 5 states by DID count
  const topStates = Object.entries(stats.stateBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const cards = [
    {
      label: "TOTAL DIDS",
      value: stats.totalDIDs.toLocaleString(),
      color: "#39ff14",
    },
    {
      label: "AREA CODES",
      value: stats.uniqueAreaCodes.toLocaleString(),
      color: "#00bfff",
    },
    {
      label: "STATES",
      value: Object.keys(stats.stateBreakdown).length.toLocaleString(),
      color: "#ff6b9d",
    },
    {
      label: "UNMAPPED",
      value: stats.unmappedCount.toLocaleString(),
      color: stats.unmappedCount > 0 ? "#ffdd00" : "#39ff14",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-[color:var(--c)]/20 bg-black/50 p-4 text-center backdrop-blur"
            style={
              {
                "--c": card.color,
                borderColor: `${card.color}33`,
                boxShadow: `0 0 15px ${card.color}15`,
              } as React.CSSProperties
            }
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
          </div>
        ))}
      </div>

      {topStates.length > 0 && (
        <div className="rounded-lg border border-[#39ff14]/20 bg-black/50 p-4 backdrop-blur">
          <div className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase mb-3 text-[#39ff14]"
            style={{ textShadow: "0 0 6px rgba(57, 255, 20, 0.6)" }}
          >
            [ TOP STATES/PROVINCES ]
          </div>
          <div className="space-y-2">
            {topStates.map(([state, count]) => {
              const pct = (count / stats.totalDIDs) * 100;
              return (
                <div key={state} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-white/70 w-32 truncate">
                    {state}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#39ff14]/60"
                      style={{
                        width: `${pct}%`,
                        boxShadow: "0 0 8px rgba(57, 255, 20, 0.4)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[#39ff14]/80 w-16 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
