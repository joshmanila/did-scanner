import { notFound } from "next/navigation";
import StatsCards from "@/components/stats-cards";
import DIDTable from "@/components/did-table";
import DidMapWrapper from "@/components/did-map-wrapper";
import AreaCodeExportButton from "@/components/dialer/area-code-export-button";
import { getDialerById } from "@/lib/queries";
import { getAreaCodeGroupsForDialer } from "@/lib/area-code-rollups";
import { nyDateStringDaysAgo, nyTodayString } from "@/lib/ny-time";

export const dynamic = "force-dynamic";

export default async function AreaCodesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const from = nyDateStringDaysAgo(30);
  const to = nyTodayString();
  const { groups, stats } = await getAreaCodeGroupsForDialer(id, from, to);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[0.6rem] uppercase tracking-widest text-white/40">
          30-day window · {from} → {to}
        </div>
        <AreaCodeExportButton groups={groups} dialerName={dialer.name} />
      </div>
      <StatsCards stats={stats} />
      {groups.length > 0 ? (
        <>
          <DidMapWrapper groups={groups} />
          <DIDTable groups={groups} />
        </>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-6 text-center">
          <p className="font-mono text-xs text-white/50">
            No data yet — check back after the next sync.
          </p>
        </div>
      )}
    </div>
  );
}
