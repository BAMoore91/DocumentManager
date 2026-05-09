import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { UserRemovalModal } from "@/components/user-removal-modal";
import { createUser, restoreUser } from "@/lib/actions/users";
import { assignCustomRole } from "@/lib/actions/custom-roles";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [users, customRoles] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { documents: true } },
        customRole: { select: { id: true, name: true } },
      },
    }),
    prisma.customRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const activeUsers = users.filter((u) => !u.archivedAt);
  const archivedUsers = users.filter((u) => u.archivedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Organization Members</h1>
        <FormModal triggerLabel="Add member" title="Add member" size="lg">
          <form action={createUser} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label>Password</Label>
              <Input name="password" type="password" minLength={8} required />
            </div>
            <div>
              <Label>System role</Label>
              <Select name="role" required defaultValue="USER">
                <option value="USER">User</option>
                <option value="ORG_ADMIN">Org Admin</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Title (optional)</Label>
              <Select name="customRoleId" defaultValue="">
                <option value="">— None —</option>
                {customRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              {customRoles.length === 0 ? (
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Add titles like Foreman or Crew Leader on the Settings page.
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Add member</Button>
            </div>
          </form>
        </FormModal>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">System Role</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {activeUsers.map((u) => (
              <tr key={u.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/users/${u.id}`} className="hover:underline">
                    {u.name ?? u.email}
                  </Link>
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <form action={assignCustomRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <Select
                      name="customRoleId"
                      defaultValue={u.customRole?.id ?? ""}
                      className="h-8 text-xs"
                    >
                      <option value="">— None —</option>
                      {customRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </form>
                </td>
                <td className="px-4 py-3">{u._count.documents}</td>
                <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== session.user.id ? (
                    <UserRemovalModal
                      userId={u.id}
                      userName={u.name}
                      userEmail={u.email}
                    />
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">you</span>
                  )}
                </td>
              </tr>
            ))}
            {activeUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No active members.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {archivedUsers.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Archived members ({archivedUsers.length})
          </h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Archived</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {archivedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u._count.documents}</td>
                    <td className="px-4 py-3">
                      {u.archivedAt ? formatDate(u.archivedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <form action={restoreUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            Restore
                          </Button>
                        </form>
                        <UserRemovalModal
                          userId={u.id}
                          userName={u.name}
                          userEmail={u.email}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
