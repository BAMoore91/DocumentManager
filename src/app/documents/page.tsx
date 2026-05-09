import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/components/document-form";
import { DocumentTable } from "@/components/document-table";
import { FormModal } from "@/components/form-modal";

export default async function MyDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      customRole: {
        select: {
          requiredDocuments: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  if (!me) redirect("/login");

  const [docs, sites] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: me.id },
      orderBy: { expirationDate: "asc" },
    }),
    me.organizationId
      ? prisma.site.findMany({
          where: { organizationId: me.organizationId, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const requiredDocuments = me.customRole?.requiredDocuments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <FormModal triggerLabel="Upload document" title="Upload document" size="lg">
          <DocumentForm
            owners={[me]}
            lockedOwnerId={me.id}
            requiredDocuments={requiredDocuments}
            sites={sites}
          />
        </FormModal>
      </div>
      <DocumentTable docs={docs} />
    </div>
  );
}
