import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomRole, deleteCustomRole } from "@/lib/actions/custom-roles";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const customRoles = await prisma.customRole.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Custom roles</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Add job titles for your members (Foreman, Crew Leader, Safety Officer, etc.).
          These are labels — they don't change what someone can do, which is controlled
          by the system role (Org Admin or User).
        </p>
      </div>

      <Card>
        <form action={createCustomRole} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="organizationId" value={orgId} />
          <div className="flex-1">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" name="name" required maxLength={60} placeholder="Foreman" />
          </div>
          <Button type="submit">Add role</Button>
        </form>

        <div className="mt-6 divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
          {customRoles.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {r._count.users} {r._count.users === 1 ? "member" : "members"}
                </span>
              </div>
              <form action={deleteCustomRole}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          ))}
          {customRoles.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No custom roles yet — add one above.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
