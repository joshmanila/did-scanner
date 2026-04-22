import { notFound } from "next/navigation";
import UploadForm from "@/components/acid-lists/upload-form";
import ListsTable from "@/components/acid-lists/lists-table";
import DriftSection from "@/components/acid-lists/drift-section";
import {
  getAcidListsForDialer,
  getDialerById,
  getDriftDidsForDialer,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AcidListsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dialer = await getDialerById(id);
  if (!dialer) notFound();
  const [lists, drift] = await Promise.all([
    getAcidListsForDialer(id),
    dialer.activeAcidListId ? getDriftDidsForDialer(id) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-4">
      <UploadForm dialerId={id} />
      <ListsTable
        dialerId={id}
        activeAcidListId={dialer.activeAcidListId}
        lists={lists}
      />
      {dialer.activeAcidListId && (
        <DriftSection dialerId={id} drift={drift} />
      )}
    </div>
  );
}
