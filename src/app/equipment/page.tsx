import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { createEquipment } from "@/lib/actions/equipment";
import { cn, formatDate } from "@/lib/utils";

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  OUT_OF_SERVICE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  RETIRED: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

const STATUS_LABELS = {
  ACTIVE: "Active",
  OUT_OF_SERVICE: "Out of service",
  RETIRED: "Retired",
};

export default async function EquipmentListPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ORG_ADMIN";

  const [equipment, sites] = await Promise.all([
    prisma.equipment.findMany({
      where: { organizationId: orgId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        site: { select: { name: true } },
        inspections: {
          orderBy: { performedAt: "desc" },
          take: 1,
          select: { performedAt: true, result: true },
        },
      },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Equipment</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Inventory of forklifts, lifts, harnesses, ladders, and other equipment
            requiring inspections.
          </p>
        </div>
        {isAdmin ? (
          <FormModal triggerLabel="Add equipment" title="Add equipment" size="lg">
            <form action={createEquipment} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required maxLength={120} placeholder="Forklift #3" />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Input id="type" name="type" maxLength={60} placeholder="Forklift" />
              </div>
              <div>
                <Label htmlFor="serialNumber">Serial number</Label>
                <Input id="serialNumber" name="serialNumber" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input id="manufacturer" name="manufacturer" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="siteId">Site (optional)</Label>
                <Select id="siteId" name="siteId" defaultValue="">
                  <option value="">— No site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" maxLength={2000} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Add equipment</Button>
              </div>
            </form>
          </FormModal>
        ) : null}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last inspection</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => {
              const last = e.inspections[0];
              return (
                <tr key={e.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/equipment/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                    {e.serialNumber ? (
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        S/N {e.serialNumber}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{e.type ?? "—"}</td>
                  <td className="px-4 py-3">{e.site?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[e.status],
                      )}
                    >
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {last
                      ? `${formatDate(last.performedAt)} · ${last.result.replace(/_/g, " ")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/equipment/${e.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-xs hover:bg-[hsl(var(--muted))]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
            {equipment.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No equipment yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
