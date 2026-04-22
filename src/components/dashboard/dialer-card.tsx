import Link from "next/link";
import type { DialerCardData } from "@/lib/aggregates";
import { HEALTH_COLORS } from "@/lib/status";
import Sparkline from "./sparkline";

interface DialerCardProps {
  data: DialerCardData;
}

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function syncColor(date: Date | null): string {
  if (!date) return "#ff003c";
  const ms = Date.now() - date.getTime();
  if (ms < 15 * 60 * 1000) return "#39ff14";
  if (ms < 2 * 60 * 60 * 1000) return "#ffdd57";
  return "#ff003c";
}

export default function DialerCard({ data }: DialerCardProps) {
  const healthColor = HEALTH_COLORS[data.health];
  const syncC = syncColor(data.lastSyncAt);
  return (
    <Link
      href={`/dialer/${data.id}`}
      className="block rounded-lg border border-white/10 bg-black/50 backdrop-blur p-4 hover:border-[#39ff14]/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.1)] transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="font-mono text-sm font-bold tracking-wider uppercase"
          style={{ color: healthColor, textShadow: `0 0 6px ${healthColor}99` }}
        >
          {data.name}
        </div>
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{
            background: healthColor,
            boxShadow: `0 0 8px ${healthColor}cc`,
          }}
        />
      </div>

      <div className="space-y-2">
        <CardRow
          label="Dials today"
          value={data.dialsToday.toLocaleString()}
          color="#39ff14"
        />
        <CardRow
          label="Contact rate"
          value={`${(data.contactRateToday * 100).toFixed(1)}%`}
          color="#00bfff"
        />
        <CardRow
          label="Last-hour dials"
          value={data.lastHourDials.toLocaleString()}
          color="#a020f0"
        />
        <CardRow
          label="DIDs over cap"
          value={data.overCapCount.toLocaleString()}
          color="#ff9500"
        />
        <CardRow
          label="Dormant DIDs"
          value={data.dormantCount.toLocaleString()}
          color="#ff3860"
        />
        <CardRow
          label="Active campaigns"
          value={data.activeCampaigns.toLocaleString()}
          color="#ffdd57"
        />
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[0.55rem] uppercase tracking-wider text-white/40">
            14-day dials
          </span>
        </div>
        <Sparkline values={data.dialsLast14d} color="#39ff14" height={28} />
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-wider text-white/40">
          Last sync
        </span>
        <span
          className="font-mono text-[0.65rem]"
          style={{ color: syncC, textShadow: `0 0 6px ${syncC}99` }}
        >
          {timeAgo(data.lastSyncAt)}
        </span>
      </div>
    </Link>
  );
}

function CardRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-white/50">
        {label}
      </span>
      <span
        className="font-mono text-sm font-bold"
        style={{ color, textShadow: `0 0 6px ${color}66` }}
      >
        {value}
      </span>
    </div>
  );
}
