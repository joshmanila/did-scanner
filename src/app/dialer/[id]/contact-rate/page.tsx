import { notFound } from "next/navigation";
import ContactRateUploadForm from "@/components/contact-rate/upload-form";
import ReportsTable from "@/components/contact-rate/reports-table";
import {
  getContactRateReportsForDialer,
  getDialerById,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ContactRatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const reports = await getContactRateReportsForDialer(id);

  return (
    <div className="space-y-4">
      <ContactRateUploadForm dialerId={id} />
      <ReportsTable
        dialerId={id}
        activeReportId={dialer.activeContactRateReportId}
        reports={reports.map((r) => ({
          id: r.id,
          name: r.name,
          periodFrom: r.periodFrom,
          periodTo: r.periodTo,
          totalCalls: r.totalCalls,
          totalContacts: r.totalContacts,
          didCount: r.didCount,
          uploadedAt: r.uploadedAt,
        }))}
      />
    </div>
  );
}
