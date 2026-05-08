import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrgDashboard } from "@/components/org-dashboard";

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/super-admin/organizations"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← All organizations
      </Link>
      <OrgDashboard
        orgId={org.id}
        title={org.name}
        subtitle="Organization metrics and upcoming expirations."
      />
    </div>
  );
}
