import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/components/document-form";
import { DocumentTable } from "@/components/document-table";
import { FormModal } from "@/components/form-modal";

export default async function AdminDocumentsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [members, docs, requiredDocuments, sites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { expirationDate: "asc" },
      include: { owner: { select: { name: true, email: true } } },
    }),
    prisma.requiredDocument.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <FormModal triggerLabel="Upload document" title="Upload document" size="lg">
          <DocumentForm
            owners={members}
            requiredDocuments={requiredDocuments}
            sites={sites}
          />
        </FormModal>
      </div>
      <DocumentTable docs={docs} showOwner />
    </div>
  );
}
