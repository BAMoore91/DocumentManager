import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { UserDashboardContent } from "@/components/user-dashboard-content";

export default async function SuperAdminUserDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      customRole: { select: { name: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!user) notFound();

  const displayName = user.name ?? user.email;
  const subtitleParts = [
    user.email,
    user.role.replace("_", " "),
    user.customRole?.name,
    user.organization?.name,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Link
        href={
          user.organization
            ? `/super-admin/organizations/${user.organization.id}`
            : "/super-admin/users"
        }
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← {user.organization ? user.organization.name : "All users"}
      </Link>
      <UserDashboardContent
        userId={user.id}
        title={displayName}
        subtitle={subtitleParts.join(" · ")}
        complianceHeading="Compliance"
      />
    </div>
  );
}
