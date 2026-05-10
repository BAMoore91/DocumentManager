import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import {
  createOrganization,
  deleteOrganization,
  setOrganizationUserLimit,
} from "@/lib/actions/organizations";
import { cn, formatDate } from "@/lib/utils";

export default async function OrganizationsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, documents: true } } },
  });

  const activeUserCounts = await prisma.user.groupBy({
    by: ["organizationId"],
    where: { archivedAt: null, organizationId: { not: null } },
    _count: { _all: true },
  });
  const activeByOrg = new Map<string, number>(
    activeUserCounts.map((g) => [g.organizationId as string, g._count._all]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <FormModal triggerLabel="Create organization" title="Create organization">
          <form action={createOrganization} className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={2} placeholder="Acme Inc." />
            </div>
            <div>
              <Label htmlFor="userLimit">User limit (optional)</Label>
              <Input
                id="userLimit"
                name="userLimit"
                type="number"
                min={1}
                max={100000}
                placeholder="Unlimited"
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Maximum active (non-archived) users this org can have. Leave blank for unlimited.
              </p>
            </div>
            <Button type="submit">Create</Button>
          </form>
        </FormModal>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Active users</th>
              <th className="px-4 py-3">User limit</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => {
              const active = activeByOrg.get(o.id) ?? 0;
              const limit = o.userLimit;
              const isFull = limit !== null && active >= limit;
              return (
                <tr
                  key={o.id}
                  className="border-b border-[hsl(var(--border))] last:border-0 align-top"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/super-admin/organizations/${o.id}`} className="hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "tabular-nums",
                        isFull && "font-semibold text-red-600 dark:text-red-300",
                      )}
                    >
                      {active}
                      {limit !== null ? ` / ${limit}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={setOrganizationUserLimit}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={o.id} />
                      <Input
                        name="userLimit"
                        type="number"
                        min={1}
                        max={100000}
                        defaultValue={limit ?? ""}
                        placeholder="Unlimited"
                        className="h-8 w-24"
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Save
                      </Button>
                    </form>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{o._count.documents}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteOrganization}>
                      <input type="hidden" name="id" value={o.id} />
                      <Button variant="danger" size="sm" type="submit">
                        Delete
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
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
