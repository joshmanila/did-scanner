import { getDialerOverview } from "@/lib/aggregates";
import DialerOverview from "@/components/dialer/overview";

export const dynamic = "force-dynamic";

export default async function DialerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const overview = await getDialerOverview(id);
  return <DialerOverview overview={overview} />;
}
