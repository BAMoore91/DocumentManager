import { prisma } from "@/lib/db";
import { SuperAdminDocumentForm } from "@/components/super-admin-document-form";
import { DocumentTable } from "@/components/document-table";

export default async function SuperAdminDocumentsPage() {
  const [organizations, docs] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        users: {
          where: { role: { in: ["ORG_ADMIN", "USER"] } },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.document.findMany({
      orderBy: { expirationDate: "asc" },
      include: {
        owner: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Upload a document on behalf of any user in any organization.
      </p>
      <SuperAdminDocumentForm organizations={organizations} />
      <DocumentTable docs={docs} showOwner showOrganization />
    </div>
  );
}
