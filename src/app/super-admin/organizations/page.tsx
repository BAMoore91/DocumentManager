import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrganization, deleteOrganization } from "@/lib/actions/organizations";
import { formatDate } from "@/lib/utils";

export default async function OrganizationsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, documents: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Organizations</h1>

      <Card>
        <h2 className="mb-3 font-medium">Create organization</h2>
        <form action={createOrganization} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} placeholder="Acme Inc." />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/super-admin/organizations/${o.id}`} className="hover:underline">
                    {o.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{o._count.users}</td>
                <td className="px-4 py-3">{o._count.documents}</td>
                <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteOrganization}>
                    <input type="hidden" name="id" value={o.id} />
                    <Button variant="danger" size="sm" type="submit">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No organizations yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
