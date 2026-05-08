import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ExpirationCalendar } from "@/components/expiration-calendar";

export default async function OrgCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; view?: string }>;
}) {
  const { id } = await params;
  const { m, view } = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/super-admin/organizations/${org.id}`}
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← {org.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{org.name} — Calendar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Document expirations and events across this organization.
        </p>
      </div>
      <ExpirationCalendar
        orgId={org.id}
        monthParam={m}
        view={view}
        basePath={`/super-admin/organizations/${org.id}/calendar`}
        canManageEvents
      />
    </div>
  );
}
