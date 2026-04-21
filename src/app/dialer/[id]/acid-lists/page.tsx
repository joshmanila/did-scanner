import { notFound } from "next/navigation";
import UploadForm from "@/components/acid-lists/upload-form";
import ListsTable from "@/components/acid-lists/lists-table";
import { getAcidListsForDialer, getDialerById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AcidListsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const lists = await getAcidListsForDialer(id);
  return (
    <div className="space-y-4">
      <UploadForm dialerId={id} />
      <ListsTable lists={lists} />
    </div>
  );
}
