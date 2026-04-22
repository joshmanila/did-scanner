import Link from "next/link";
import type { RecentSyncFailure } from "@/lib/queries";

interface SyncFailureBannerProps {
  failures: RecentSyncFailure[];
}

export default function SyncFailureBanner({ failures }: SyncFailureBannerProps) {
  if (failures.length === 0) return null;
  return (
    <div
      className="rounded-lg border bg-black/60 backdrop-blur p-3"
      style={{
        borderColor: "#ff003c66",
        boxShadow: "0 0 14px rgba(255,0,60,0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-mono text-[0.6rem] uppercase tracking-widest font-bold"
          style={{ color: "#ff003c", textShadow: "0 0 6px #ff003c99" }}
        >
          ⚠ Sync Failure{failures.length > 1 ? "s" : ""} ({failures.length})
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-wider text-white/40">
          Most recent run ended in failure
        </span>
      </div>
      <ul className="space-y-1">
        {failures.map((f) => (
          <li
            key={f.dialerId}
            className="flex items-center justify-between gap-3"
          >
            <Link
              href={`/dialer/${f.dialerId}`}
              className="font-mono text-xs font-bold hover:underline"
              style={{ color: "#ff003c", textShadow: "0 0 6px #ff003c66" }}
            >
              {f.dialerName}
            </Link>
            <span className="font-mono text-[0.6rem] text-white/60 truncate max-w-[60%]">
              {f.errorMessage ?? "unknown error"}
            </span>
            <span className="font-mono text-[0.55rem] text-white/40 uppercase tracking-wider shrink-0">
              {timeAgo(f.failedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
