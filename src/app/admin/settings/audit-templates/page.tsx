import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import {
  createAuditTemplate,
  deleteAuditTemplate,
} from "@/lib/actions/audit-templates";

export default async function AuditTemplatesPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const templates = await prisma.auditTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, audits: true } } },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit templates</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Define reusable checklists (e.g. weekly site walk) so audits start
            with the right items. Each item is recorded as PASS / FAIL / N/A on
            the audit.
          </p>
        </div>
        <FormModal triggerLabel="New template" title="New audit template">
          <form action={createAuditTemplate} className="space-y-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label>Name</Label>
              <Input name="name" required maxLength={120} placeholder="Weekly site walk" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea name="description" maxLength={2000} />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </FormModal>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={`/admin/settings/audit-templates/${t.id}`}
                className="font-medium hover:underline"
              >
                {t.name}
              </Link>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {t._count.items} item{t._count.items === 1 ? "" : "s"} ·{" "}
                {t._count.audits} audit{t._count.audits === 1 ? "" : "s"} using this
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/settings/audit-templates/${t.id}`}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Edit items
              </Link>
              <form action={deleteAuditTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ))}
        {templates.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No audit templates yet.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
