import { notFound } from "next/navigation";
import TopNav from "@/components/nav/top-nav";
import SubTabRow from "@/components/dialer/sub-tab-row";
import { getDialerById, getLastSyncRun } from "@/lib/queries";

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

export default async function DialerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const lastSync = await getLastSyncRun(id);

  const syncColor =
    lastSync?.status === "success"
      ? "#39ff14"
      : lastSync?.status === "failed"
        ? "#ff003c"
        : "#ffdd57";
  const syncLabel = lastSync
    ? `${lastSync.status} · ${timeAgo(lastSync.startedAt)}`
    : "never";

  return (
    <>
      <TopNav activeDialerId={id} />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="font-mono text-xl font-bold tracking-widest uppercase text-[#39ff14] text-glow-green"
            >
              {dialer.name}
            </h1>
            <p className="font-mono text-[0.6rem] text-white/40 uppercase tracking-widest mt-1">
              {dialer.convosoApiUrl}
              {!dialer.isActive ? " · PAUSED" : ""}
            </p>
          </div>
          <div
            className="font-mono text-[0.6rem] uppercase tracking-widest px-3 py-1.5 rounded border"
            style={{
              color: syncColor,
              borderColor: `${syncColor}66`,
              boxShadow: `0 0 8px ${syncColor}33`,
            }}
          >
            Last sync: {syncLabel}
          </div>
        </header>
        <SubTabRow dialerId={id} />
        <div>{children}</div>
      </div>
    </>
  );
}
