import Link from "next/link";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 1;
const CRITICAL_AFTER_DAYS = 3;
const DRIFT_THRESHOLD = 50;

interface Props {
  dialerId: string;
  hasActiveList: boolean;
  activeListName: string | null;
  activeListUploadedAt: Date | null;
  driftCount: number;
}

function ageInDays(uploadedAt: Date): number {
  return (Date.now() - new Date(uploadedAt).getTime()) / DAY_MS;
}

export default function StalenessBanner({
  dialerId,
  hasActiveList,
  activeListName,
  activeListUploadedAt,
  driftCount,
}: Props) {
  const href = `/dialer/${dialerId}/acid-lists`;

  if (!hasActiveList) {
    return (
      <BannerShell
        color="#ff3860"
        href={href}
        cta="GO TO ACID LISTS"
        message="No active ACID list set. Upload one from Convoso so DID metrics reflect your real dialing universe."
      />
    );
  }

  const ageDays = activeListUploadedAt ? ageInDays(activeListUploadedAt) : null;
  const isStale = ageDays !== null && ageDays >= STALE_AFTER_DAYS;
  const isCritical = ageDays !== null && ageDays >= CRITICAL_AFTER_DAYS;
  const hasDrift = driftCount >= DRIFT_THRESHOLD;

  if (!isStale && !hasDrift) return null;

  const color = isCritical || hasDrift ? "#ff3860" : "#ffdd57";
  const ageText =
    ageDays === null
      ? ""
      : ageDays < 2
        ? "1 day old"
        : `${Math.floor(ageDays)} days old`;

  const parts: string[] = [];
  if (isStale && activeListName) {
    parts.push(`Active ACID list "${activeListName}" is ${ageText}.`);
  } else if (isStale) {
    parts.push(`Active ACID list is ${ageText}.`);
  }
  if (hasDrift) {
    parts.push(
      `${driftCount.toLocaleString()} dialed DIDs are not in the active list.`
    );
  }
  parts.push("Re-upload latest from Convoso.");

  return (
    <BannerShell
      color={color}
      href={href}
      cta="GO TO ACID LISTS"
      message={parts.join(" ")}
    />
  );
}

function BannerShell({
  color,
  href,
  cta,
  message,
}: {
  color: string;
  href: string;
  cta: string;
  message: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border bg-black/50 px-4 py-3 backdrop-blur"
      style={{
        borderColor: `${color}66`,
        boxShadow: `0 0 15px ${color}22`,
      }}
    >
      <div
        className="font-mono text-xs"
        style={{ color, textShadow: `0 0 6px ${color}66` }}
      >
        <span className="font-bold tracking-wider uppercase mr-2">[ stale ]</span>
        {message}
      </div>
      <Link
        href={href}
        className="font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded border whitespace-nowrap transition-all hover:bg-white/5"
        style={{ borderColor: `${color}66`, color }}
      >
        {cta} →
      </Link>
    </div>
  );
}
