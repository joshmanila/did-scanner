import { getDialerOverview } from "@/lib/aggregates";
import TopNList from "@/components/dialer/top-n-list";

export const dynamic = "force-dynamic";

function fmtDid(raw: string): string {
  if (raw.length === 10) {
    return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return raw;
}

export default async function DialerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const overview = await getDialerOverview(id);

  const headline = [
    {
      label: "30-DAY DIALS",
      value: overview.totalDials30d.toLocaleString(),
      color: "#39ff14",
    },
    {
      label: "30-DAY CONTACT RATE",
      value: `${(overview.contactRate30d * 100).toFixed(1)}%`,
      color: "#00bfff",
    },
    {
      label: "ACTIVE DIALING",
      value: `${overview.activeDays} days`,
      color: "#a020f0",
    },
    {
      label: "TOTAL DIDS",
      value: overview.totalDids.toLocaleString(),
      color: "#39ff14",
    },
    {
      label: "DORMANT (30D)",
      value: overview.dormantCount.toLocaleString(),
      color: "#ff3860",
    },
    {
      label: "OVER CAP",
      value: overview.overCapCount.toLocaleString(),
      color: "#ff9500",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {headline.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border bg-black/50 p-4 text-center backdrop-blur"
            style={{
              borderColor: `${card.color}33`,
              boxShadow: `0 0 15px ${card.color}15`,
            }}
          >
            <div
              className="font-mono text-[0.55rem] font-bold tracking-[0.2em] uppercase mb-2"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopNList
          title="Top 10 DIDs by Dials (30d)"
          color="#39ff14"
          rows={overview.topByDials.map((r) => ({
            primary: fmtDid(r.did),
            secondary: `area ${r.areaCode} · ${r.dialsPerDay.toFixed(1)}/day`,
            value: r.totalDials.toLocaleString(),
            tag: { label: r.band.toUpperCase(), color: r.color },
          }))}
        />
        <TopNList
          title="Top 10 Dormant DIDs"
          color="#ff3860"
          rows={overview.topDormant.map((r) => ({
            primary: fmtDid(r.did),
            secondary: `area ${r.areaCode}`,
            value: "0",
          }))}
          emptyMessage="No dormant DIDs."
        />
        <TopNList
          title="Top 10 Over-cap DIDs"
          color="#ff9500"
          rows={overview.topOverCap.map((r) => ({
            primary: fmtDid(r.did),
            secondary: `area ${r.areaCode} · ${r.dialsPerDay.toFixed(1)}/day`,
            value: r.totalDials.toLocaleString(),
          }))}
          emptyMessage="No DIDs above cap."
        />
      </div>
    </div>
  );
}
