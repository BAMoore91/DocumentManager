import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteAudit, updateAudit } from "@/lib/actions/audits";
import { recordAuditFinding } from "@/lib/actions/audit-templates";
import { PrintButton } from "@/components/print-button";
import { cn, formatDate } from "@/lib/utils";

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const [audit, sites, capas] = await Promise.all([
    prisma.audit.findUnique({
      where: { id },
      include: {
        conductedBy: { select: { name: true, email: true } },
        site: { select: { id: true, name: true } },
        template: { select: { name: true } },
        findingItems: { orderBy: { position: "asc" } },
      },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.correctiveAction.findMany({
      where: { organizationId: orgId, sourceType: "AUDIT", sourceId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, dueDate: true },
    }),
  ]);
  if (!audit || audit.organizationId !== orgId) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/audits"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Audits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{audit.title}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Conducted by {audit.conductedBy.name ?? audit.conductedBy.email} ·{" "}
            {formatDate(audit.conductedAt)}
            {audit.site ? ` · ${audit.site.name}` : ""}
          </p>
          {audit.scoreNumerator !== null && audit.scoreDenominator ? (
            <p className="mt-1 text-sm">
              Score: {audit.scoreNumerator} / {audit.scoreDenominator} (
              {Math.round((audit.scoreNumerator / audit.scoreDenominator) * 100)}%)
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <PrintButton />
          <form action={deleteAudit}>
            <input type="hidden" name="id" value={audit.id} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>

      {audit.findingItems.length > 0 ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">
              Checklist
              {audit.template ? (
                <span className="ml-2 text-sm font-normal text-[hsl(var(--muted-foreground))]">
                  · {audit.template.name}
                </span>
              ) : null}
            </h2>
          </div>
          <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
            {audit.findingItems.map((it, idx) => (
              <form
                key={it.id}
                action={recordAuditFinding}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
              >
                <input type="hidden" name="itemId" value={it.id} />
                <div className="min-w-0 flex-1">
                  {idx + 1}. {it.label}
                </div>
                <select
                  name="result"
                  defaultValue={it.result ?? ""}
                  className={cn(
                    "h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs",
                    it.result === "PASS" && "text-emerald-700",
                    it.result === "FAIL" && "text-red-700",
                  )}
                >
                  <option value="">—</option>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                  <option value="NA">N/A</option>
                </select>
                <input
                  name="notes"
                  defaultValue={it.notes ?? ""}
                  placeholder="Notes (optional)"
                  className="h-8 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}

      {audit.findings ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Findings
          </h2>
          <p className="whitespace-pre-wrap text-sm">{audit.findings}</p>
        </Card>
      ) : null}

      {audit.notes ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm">{audit.notes}</p>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Corrective actions from this audit</h2>
          <Link
            href={`/corrective-actions/new?sourceType=AUDIT&sourceId=${audit.id}&title=${encodeURIComponent(
              audit.title,
            )}`}
            className="inline-flex h-8 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-3 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            New corrective action
          </Link>
        </div>
        <div className="space-y-1">
          {capas.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
            >
              <Link href={`/corrective-actions/${c.id}`} className="font-medium hover:underline">
                {c.title}
              </Link>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {c.status.replace(/_/g, " ")}
                {c.dueDate ? ` · due ${formatDate(c.dueDate)}` : ""}
              </span>
            </div>
          ))}
          {capas.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No corrective actions linked to this audit yet.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="print:hidden">
        <h2 className="mb-3 font-medium">Edit audit</h2>
        <form action={updateAudit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={audit.id} />
          <div>
            <Label>Title</Label>
            <Input name="title" required maxLength={200} defaultValue={audit.title} />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              name="conductedAt"
              type="date"
              required
              defaultValue={audit.conductedAt.toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <Label>Site</Label>
            <Select name="siteId" defaultValue={audit.siteId ?? ""}>
              <option value="">— No site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={audit.status}>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </div>
          <div>
            <Label>Score numerator</Label>
            <Input
              name="scoreNumerator"
              type="number"
              min={0}
              max={100000}
              defaultValue={audit.scoreNumerator ?? ""}
            />
          </div>
          <div>
            <Label>Score denominator</Label>
            <Input
              name="scoreDenominator"
              type="number"
              min={0}
              max={100000}
              defaultValue={audit.scoreDenominator ?? ""}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Findings</Label>
            <Textarea name="findings" maxLength={20000} defaultValue={audit.findings ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea name="notes" maxLength={20000} defaultValue={audit.notes ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
