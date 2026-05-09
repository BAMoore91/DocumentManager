import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAudit } from "@/lib/actions/audits";
import { formatDate } from "@/lib/utils";

export default async function AuditsListPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [audits, sites] = await Promise.all([
    prisma.audit.findMany({
      where: { organizationId: orgId },
      orderBy: { conductedAt: "desc" },
      include: {
        conductedBy: { select: { name: true, email: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Safety Audits</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Periodic walkthroughs and inspections. Capture findings here, then
          spawn corrective actions for any issues that need follow-up.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">New audit</h2>
        <form action={createAudit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} placeholder="Q2 site walk" />
          </div>
          <div>
            <Label htmlFor="conductedAt">Date</Label>
            <Input id="conductedAt" name="conductedAt" type="date" required defaultValue={today} />
          </div>
          <div>
            <Label htmlFor="siteId">Site</Label>
            <Select id="siteId" name="siteId" defaultValue="">
              <option value="">— No site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="scoreNumerator">Score</Label>
              <Input id="scoreNumerator" name="scoreNumerator" type="number" min={0} max={100000} />
            </div>
            <div>
              <Label htmlFor="scoreDenominator">Out of</Label>
              <Input
                id="scoreDenominator"
                name="scoreDenominator"
                type="number"
                min={0}
                max={100000}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="findings">Findings</Label>
            <Textarea id="findings" name="findings" maxLength={20000} className="min-h-[100px]" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={20000} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create audit</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Conductor</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/audits/${a.id}`} className="hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(a.conductedAt)}</td>
                <td className="px-4 py-3">{a.site?.name ?? "—"}</td>
                <td className="px-4 py-3">{a.conductedBy.name ?? a.conductedBy.email}</td>
                <td className="px-4 py-3 tabular-nums">
                  {a.scoreNumerator !== null && a.scoreDenominator
                    ? `${a.scoreNumerator} / ${a.scoreDenominator} (${Math.round(
                        (a.scoreNumerator / a.scoreDenominator) * 100,
                      )}%)`
                    : "—"}
                </td>
              </tr>
            ))}
            {audits.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No audits yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
