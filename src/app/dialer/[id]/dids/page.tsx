import { notFound } from "next/navigation";
import PerDidTable from "@/components/dialer/per-did-table";
import { getDialerById, getAllAcidListDidsForDialer } from "@/lib/queries";
import { getDidRowsForDialer } from "@/lib/aggregates";
import { nyDateStringDaysAgo, nyTodayString } from "@/lib/ny-time";

export const dynamic = "force-dynamic";

export default async function DidsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const from = nyDateStringDaysAgo(30);
  const to = nyTodayString();
  const acidSet = await getAllAcidListDidsForDialer(id);
  const rows = await getDidRowsForDialer(id, from, to, acidSet);
  return (
    <div className="space-y-4">
      <PerDidTable rows={rows} dialerName={dialer.name} />
    </div>
  );
}
