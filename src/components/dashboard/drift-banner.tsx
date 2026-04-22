import Link from "next/link";
import type { DialerDriftSummary } from "@/lib/queries";

interface DriftBannerProps {
  dialers: DialerDriftSummary[];
}

export default function DriftBanner({ dialers }: DriftBannerProps) {
  if (dialers.length === 0) return null;
  const totalDrift = dialers.reduce((acc, d) => acc + d.driftCount, 0);
  return (
    <div
      className="rounded-lg border bg-black/60 backdrop-blur p-3"
      style={{
        borderColor: "#ffa50066",
        boxShadow: "0 0 14px rgba(255,165,0,0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-mono text-[0.6rem] uppercase tracking-widest font-bold"
          style={{ color: "#ffa500", textShadow: "0 0 6px rgba(255,165,0,0.6)" }}
        >
          ⚠ {totalDrift} Detected DID{totalDrift === 1 ? "" : "s"} — Not in
          Active List
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-wider text-white/40">
          Likely auto-procured in Convoso
        </span>
      </div>
      <ul className="space-y-1">
        {dialers.map((d) => (
          <li
            key={d.dialerId}
            className="flex items-center justify-between gap-3"
          >
            <Link
              href={`/dialer/${d.dialerId}/acid-lists`}
              className="font-mono text-xs font-bold hover:underline"
              style={{ color: "#ffa500", textShadow: "0 0 6px rgba(255,165,0,0.5)" }}
            >
              {d.dialerName}
            </Link>
            <span className="font-mono text-[0.6rem] text-white/60 truncate max-w-[60%]">
              {d.driftCount.toLocaleString()} not in {d.activeListName}
            </span>
            <span className="font-mono text-[0.55rem] text-white/40 uppercase tracking-wider shrink-0">
              Review
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
