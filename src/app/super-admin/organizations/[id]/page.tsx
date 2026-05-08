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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/super-admin/organizations"
          className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          ← All organizations
        </Link>
        <Link
          href={`/super-admin/organizations/${org.id}/calendar`}
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
        >
          View calendar →
        </Link>
      </div>
      <OrgDashboard
        orgId={org.id}
        title={org.name}
        subtitle="Organization metrics and upcoming expirations."
      />
    </div>
  );
}
