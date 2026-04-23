import TopNav from "@/components/nav/top-nav";
import DialersTable from "@/components/settings/dialers-table";
import {
  getAcidListsForDialer,
  getAllDialers,
  getContactRateReportsForDialer,
  getRecentSyncRuns,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [dialers, recentSyncs] = await Promise.all([
    getAllDialers(),
    getRecentSyncRuns(50),
  ]);
  const acidListsByDialer: Record<
    string,
    Array<{ id: string; name: string; didCount: number }>
  > = {};
  const contactRateReportsByDialer: Record<
    string,
    Array<{
      id: string;
      name: string;
      didCount: number;
      totalCalls: number;
      totalContacts: number;
    }>
  > = {};
  await Promise.all(
    dialers.map(async (d) => {
      const [lists, reports] = await Promise.all([
        getAcidListsForDialer(d.id),
        getContactRateReportsForDialer(d.id),
      ]);
      acidListsByDialer[d.id] = lists.map((l) => ({
        id: l.id,
        name: l.name,
        didCount: l.didCount,
      }));
      contactRateReportsByDialer[d.id] = reports.map((r) => ({
        id: r.id,
        name: r.name,
        didCount: r.didCount,
        totalCalls: r.totalCalls,
        totalContacts: r.totalContacts,
      }));
    })
  );

  return (
    <>
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="font-mono text-xl font-bold tracking-widest uppercase text-[#39ff14] text-glow-green">
            Settings
          </h1>
          <p className="font-mono text-[0.6rem] text-white/40 uppercase tracking-widest mt-1">
            Dialer credentials + sync schedule
          </p>
        </header>

        <DialersTable
          dialers={dialers}
          acidListsByDialer={acidListsByDialer}
          contactRateReportsByDialer={contactRateReportsByDialer}
          recentSyncs={recentSyncs.map((r) => ({
            dialerId: r.dialerId,
            status: r.status,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            errorMessage: r.errorMessage,
          }))}
        />

        <section className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-4 space-y-3">
          <div
            className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#00bfff]"
            style={{ textShadow: "0 0 6px rgba(0,191,255,0.6)" }}
          >
            [ SYNC SCHEDULE ]
          </div>
          <div className="font-mono text-xs text-white/60 space-y-1">
            <div>Overnight full sync: every day at 02:00 UTC</div>
            <div>Live pulse: every 5 minutes</div>
            <div className="text-white/40 mt-2">
              Configured in <code>vercel.json</code>. Edit and redeploy to change.
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div
              className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[#a020f0]"
              style={{ textShadow: "0 0 6px rgba(160,32,240,0.6)" }}
            >
              [ RECENT SYNCS ]
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/70">
                <tr className="font-mono text-[0.6rem] uppercase tracking-wider text-white/40 border-b border-white/10">
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-right">Pages</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentSyncs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center font-mono text-xs text-white/40"
                    >
                      No syncs yet.
                    </td>
                  </tr>
                ) : (
                  recentSyncs.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-white/80 uppercase">
                        {r.kind}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs uppercase">
                        <span
                          style={{
                            color:
                              r.status === "success"
                                ? "#39ff14"
                                : r.status === "failed"
                                  ? "#ff003c"
                                  : "#ffdd57",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                        {r.startedAt.toISOString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/70 text-right">
                        {r.pagesFetched}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/70 text-right">
                        {r.rowsProcessed.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#ff003c]/80 truncate max-w-[280px]">
                        {r.errorMessage ?? ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
