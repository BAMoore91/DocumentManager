import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addAuditTemplateItem,
  deleteAuditTemplateItem,
  updateAuditTemplate,
} from "@/lib/actions/audit-templates";

export default async function AuditTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const template = await prisma.auditTemplate.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template || template.organizationId !== orgId) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings/audit-templates"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Audit templates
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {template.items.length} item{template.items.length === 1 ? "" : "s"}
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Template details</h2>
        <form action={updateAuditTemplate} className="space-y-3">
          <input type="hidden" name="id" value={template.id} />
          <div>
            <Label>Name</Label>
            <Input name="name" required maxLength={120} defaultValue={template.name} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea name="description" maxLength={2000} defaultValue={template.description ?? ""} />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Checklist items</h2>
        <div className="mb-4 space-y-2">
          {template.items.map((it, idx) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
            >
              <span>
                {idx + 1}. {it.label}
              </span>
              <form action={deleteAuditTemplateItem}>
                <input type="hidden" name="id" value={it.id} />
                <Button type="submit" variant="danger" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          ))}
          {template.items.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No items yet.
            </p>
          ) : null}
        </div>
        <form action={addAuditTemplateItem} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="templateId" value={template.id} />
          <div className="flex-1">
            <Label>Add item</Label>
            <Input name="label" required maxLength={300} placeholder="Hard hats are worn in active work areas" />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </Card>
    </div>
  );
}
