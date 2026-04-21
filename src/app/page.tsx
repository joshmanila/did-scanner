import { redirect } from "next/navigation";
import TopNav from "@/components/nav/top-nav";
import AggregateStrip from "@/components/dashboard/aggregate-strip";
import DialerCard from "@/components/dashboard/dialer-card";
import AutoRefresh from "@/components/dashboard/auto-refresh";
import { getDashboardAggregates } from "@/lib/aggregates";
import { getAllDialers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const allDialers = await getAllDialers();
  if (allDialers.length === 0) {
    redirect("/settings");
  }

  const { cards, totals } = await getDashboardAggregates();

  return (
    <>
      <TopNav />
      <AutoRefresh />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold tracking-widest uppercase text-[#39ff14] text-glow-green">
              Dashboard
            </h1>
            <p className="font-mono text-[0.6rem] text-white/40 uppercase tracking-widest mt-1">
              Multi-dialer health at a glance. Auto-refresh every 30s.
            </p>
          </div>
        </header>

        <AggregateStrip
          dialsToday={totals.dialsToday}
          contactRateToday={totals.contactRateToday}
          overCapTotal={totals.overCapTotal}
          dormantTotal={totals.dormantTotal}
          dialerCount={totals.dialerCount}
        />

        {cards.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-6 text-center">
            <p className="font-mono text-sm text-white/60">
              No active dialers. Add one in{" "}
              <a
                href="/settings"
                className="text-[#39ff14] hover:underline"
              >
                settings
              </a>
              .
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <DialerCard key={c.id} data={c} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
