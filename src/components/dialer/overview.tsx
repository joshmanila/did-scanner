import TopNList from "@/components/dialer/top-n-list";
import StalenessBanner from "@/components/dialer/staleness-banner";
import type { getDialerOverview } from "@/lib/aggregates";

type Overview = Awaited<ReturnType<typeof getDialerOverview>>;

function fmtDid(raw: string): string {
  if (raw.length === 10) {
    return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return raw;
}

interface HeadlineCard {
  label: string;
  value: string;
  color: string;
  subtext?: { text: string; color: string };
}

function reportAgeText(uploadedAt: Date | null): string {
  if (!uploadedAt) return "no report";
  const ms = Date.now() - new Date(uploadedAt).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "uploaded today";
  if (days === 1) return "uploaded yesterday";
  if (days < 7) return `uploaded ${days}d ago`;
  return `uploaded ${days}d ago — refresh?`;
}

function staleColor(uploadedAt: Date | null): string {
  if (!uploadedAt) return "rgba(255,255,255,0.4)";
  const ms = Date.now() - new Date(uploadedAt).getTime();
  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 7) return "rgba(255,255,255,0.4)";
  if (days < 14) return "#ffdd57";
  return "#ff9500";
}

export default function DialerOverview({ overview }: { overview: Overview }) {
  const totalDidsSubtext =
    overview.hasActiveList && overview.driftCount > 0
      ? {
          text: `+${overview.driftCount.toLocaleString()} drift`,
          color: "#ffa500",
        }
      : overview.hasActiveList
        ? { text: "active list", color: "rgba(255,255,255,0.4)" }
        : { text: "no active list set", color: "rgba(255,255,255,0.4)" };

  const hasReport = overview.contactRateFromReport !== null;
  const contactRateLabel = hasReport ? "CONTACT RATE (REPORT)" : "CONTACT RATE (ESTIMATED)";
  const contactRateValue = hasReport
    ? `${((overview.contactRateFromReport ?? 0) * 100).toFixed(2)}%`
    : `${(overview.contactRate30d * 100).toFixed(1)}%`;
  const contactRateSubtext = hasReport
    ? {
        text: `${overview.reportContacts.toLocaleString()}/${overview.reportCalls.toLocaleString()} · ${reportAgeText(overview.reportUploadedAt)}`,
        color: staleColor(overview.reportUploadedAt),
      }
    : {
        text: "upload Convoso report for accuracy",
        color: "rgba(255,255,255,0.4)",
      };

  const headline: HeadlineCard[] = [
    {
      label: "30-DAY DIALS",
      value: overview.totalDials30d.toLocaleString(),
      color: "#39ff14",
    },
    {
      label: contactRateLabel,
      value: contactRateValue,
      color: "#00bfff",
      subtext: contactRateSubtext,
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
      subtext: totalDidsSubtext,
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
      <StalenessBanner
        dialerId={overview.dialerId}
        hasActiveList={overview.hasActiveList}
        activeListName={overview.activeListName}
        activeListUploadedAt={overview.activeListUploadedAt}
        driftCount={overview.driftCount}
      />
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
            {card.subtext && (
              <div
                className="font-mono text-[0.6rem] mt-1 uppercase tracking-wider"
                style={{ color: card.subtext.color }}
              >
                {card.subtext.text}
              </div>
            )}
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
