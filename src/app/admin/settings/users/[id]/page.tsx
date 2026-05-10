import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { UserDashboardContent } from "@/components/user-dashboard-content";

export default async function AdminUserDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      role: true,
      customRole: { select: { name: true } },
    },
  });
  if (!user || user.organizationId !== orgId) notFound();

  const displayName = user.name ?? user.email;
  const subtitleParts = [
    user.email,
    user.role.replace("_", " "),
    user.customRole?.name,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/settings/users"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← All members
      </Link>
      <UserDashboardContent
        userId={user.id}
        title={displayName}
        subtitle={subtitleParts.join(" · ")}
        uploadHref="/admin/documents"
        complianceHeading="Compliance"
      />
    </div>
  );
}
