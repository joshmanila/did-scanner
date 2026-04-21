import { notFound } from "next/navigation";
import GapStatsCards from "@/components/gap-stats-cards";
import GapAnalysisTable from "@/components/gap-analysis-table";
import DidMapWrapper from "@/components/did-map-wrapper";
import GapExportButton from "@/components/dialer/gap-export-button";
import { getDialerById } from "@/lib/queries";
import {
  getAreaCodeGroupsForDialer,
  getCallDistributionByAreaCode,
} from "@/lib/area-code-rollups";
import { computeGapAnalysis } from "@/lib/gap-analysis";
import { nyDateStringDaysAgo, nyTodayString } from "@/lib/ny-time";

export const dynamic = "force-dynamic";

export default async function GapAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const from = nyDateStringDaysAgo(30);
  const to = nyTodayString();
  const [{ groups }, distribution] = await Promise.all([
    getAreaCodeGroupsForDialer(id, from, to),
    getCallDistributionByAreaCode(id, from, to),
  ]);
  const gap = computeGapAnalysis(distribution, groups);
  const totalCalls = Object.values(distribution).reduce(
    (sum, n) => sum + n,
    0
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#ffdd57]/30 bg-[#ffdd57]/5 backdrop-blur p-3">
        <p className="font-mono text-[0.65rem] text-[#ffdd57]/90">
          Note: this gap analysis groups calls by the DID&rsquo;s area code, not
          the lead&rsquo;s. Lead-area-code gap analysis returns in a later pass.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[0.6rem] uppercase tracking-widest text-white/40">
          30-day window · {from} → {to}
        </div>
        <GapExportButton entries={gap.entries} dialerName={dialer.name} />
      </div>
      <GapStatsCards result={gap} totalCalls={totalCalls} />
      {groups.length > 0 || gap.entries.length > 0 ? (
        <>
          <DidMapWrapper groups={groups} gapAnalysis={gap} />
          <GapAnalysisTable entries={gap.entries} />
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
