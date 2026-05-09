import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  deleteEquipment,
  deleteInspection,
  logInspection,
  setEquipmentStatus,
  updateEquipment,
} from "@/lib/actions/equipment";
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

const RESULT_LABELS = {
  PASS: "Pass",
  FAIL_NEEDS_REPAIR: "Fail — needs repair",
  FAIL_OUT_OF_SERVICE: "Fail — out of service",
};

const RESULT_STYLES = {
  PASS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  FAIL_NEEDS_REPAIR: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  FAIL_OUT_OF_SERVICE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ORG_ADMIN";
  const { id } = await params;

  const [equipment, sites] = await Promise.all([
    prisma.equipment.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        inspections: {
          orderBy: { performedAt: "desc" },
          take: 50,
          include: { performedBy: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!equipment || equipment.organizationId !== orgId) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link
        href="/equipment"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Equipment
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{equipment.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {equipment.type ?? "—"}
            {equipment.serialNumber ? ` · S/N ${equipment.serialNumber}` : ""}
            {equipment.manufacturer ? ` · ${equipment.manufacturer}` : ""}
            {equipment.site ? ` · ${equipment.site.name}` : ""}
          </p>
          <span
            className={cn(
              "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_STYLES[equipment.status],
            )}
          >
            {STATUS_LABELS[equipment.status]}
          </span>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={setEquipmentStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={equipment.id} />
              <Select name="status" defaultValue={equipment.status} className="h-8 w-auto text-xs">
                <option value="ACTIVE">Active</option>
                <option value="OUT_OF_SERVICE">Out of service</option>
                <option value="RETIRED">Retired</option>
              </Select>
              <Button type="submit" variant="secondary" size="sm">
                Update
              </Button>
            </form>
            <form action={deleteEquipment}>
              <input type="hidden" name="id" value={equipment.id} />
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Log an inspection</h2>
        <form action={logInspection} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="equipmentId" value={equipment.id} />
          <div>
            <Label htmlFor="performedAt">Date</Label>
            <Input id="performedAt" name="performedAt" type="date" required defaultValue={today} />
          </div>
          <div>
            <Label htmlFor="result">Result</Label>
            <Select id="result" name="result" required defaultValue="PASS">
              <option value="PASS">Pass</option>
              <option value="FAIL_NEEDS_REPAIR">Fail — needs repair</option>
              <option value="FAIL_OUT_OF_SERVICE">Fail — take out of service</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="defects">Defects (if any)</Label>
            <Textarea id="defects" name="defects" maxLength={5000} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={5000} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Log inspection</Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Selecting "take out of service" automatically flips the equipment to
          OUT_OF_SERVICE.
        </p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <h2 className="font-medium">Inspection history</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Defects</th>
              {isAdmin ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {equipment.inspections.map((i) => (
              <tr key={i.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(i.performedAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      RESULT_STYLES[i.result],
                    )}
                  >
                    {RESULT_LABELS[i.result]}
                  </span>
                </td>
                <td className="px-4 py-3">{i.performedBy.name ?? i.performedBy.email}</td>
                <td className="px-4 py-3">{i.defects ?? "—"}</td>
                {isAdmin ? (
                  <td className="px-4 py-3 text-right">
                    <form action={deleteInspection}>
                      <input type="hidden" name="id" value={i.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Remove
                      </Button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
            {equipment.inspections.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 5 : 4}
                  className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                >
                  No inspections logged yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {isAdmin ? (
        <Card>
          <h2 className="mb-3 font-medium">Edit equipment</h2>
          <form action={updateEquipment} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={equipment.id} />
            <div>
              <Label>Name</Label>
              <Input name="name" required maxLength={120} defaultValue={equipment.name} />
            </div>
            <div>
              <Label>Type</Label>
              <Input name="type" maxLength={60} defaultValue={equipment.type ?? ""} />
            </div>
            <div>
              <Label>Serial</Label>
              <Input
                name="serialNumber"
                maxLength={120}
                defaultValue={equipment.serialNumber ?? ""}
              />
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Input
                name="manufacturer"
                maxLength={120}
                defaultValue={equipment.manufacturer ?? ""}
              />
            </div>
            <div>
              <Label>Site</Label>
              <Select name="siteId" defaultValue={equipment.siteId ?? ""}>
                <option value="">— No site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea name="notes" maxLength={2000} defaultValue={equipment.notes ?? ""} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
