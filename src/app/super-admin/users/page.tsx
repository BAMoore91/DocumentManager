import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUser, deleteUser } from "@/lib/actions/users";

export default async function SuperAdminUsersPage() {
  const [orgs, users] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { organization: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Administrators & Users</h1>

      <Card>
        <h2 className="mb-3 font-medium">Create user</h2>
        <form action={createUser} className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            <Label>Role</Label>
            <Select name="role" required defaultValue="ORG_ADMIN">
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ORG_ADMIN">Org Admin</option>
              <option value="USER">User</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Organization (required for org admins/users)</Label>
            <Select name="organizationId" defaultValue="">
              <option value="">— None —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create user</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role.replace("_", " ")}</td>
                <td className="px-4 py-3">{u.organization?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
