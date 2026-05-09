import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { createForm, deleteForm, setFormStatus } from "@/lib/actions/forms";
import { cn, formatDate } from "@/lib/utils";

export default async function FormsSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const forms = await prisma.form.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { fields: true, submissions: true } } },
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
          <h1 className="text-2xl font-semibold">Forms</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Build custom fillable forms for your members — daily checklists, incident
            reports, sign-offs, etc. Save as a draft, add fields, then publish so users
            can fill them from the Forms menu.
          </p>
        </div>
        <FormModal triggerLabel="Create form" title="Create a form">
          <form action={createForm} className="space-y-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label htmlFor="form-name">Form name</Label>
              <Input
                id="form-name"
                name="name"
                required
                maxLength={120}
                placeholder="Daily safety checklist"
              />
            </div>
            <div>
              <Label htmlFor="form-description">Description (optional)</Label>
              <Textarea
                id="form-description"
                name="description"
                maxLength={2000}
                placeholder="What this form is for"
              />
            </div>
            <Button type="submit">Create form</Button>
          </form>
        </FormModal>
      </div>

      <div className="space-y-2">
        {forms.map((f) => (
          <Card
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/forms/${f.id}`}
                  className="font-medium hover:underline"
                >
                  {f.name}
                </Link>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    f.status === "PUBLISHED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {f.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {f._count.fields} field{f._count.fields === 1 ? "" : "s"} ·{" "}
                {f._count.submissions} submission
                {f._count.submissions === 1 ? "" : "s"} · Updated{" "}
                {formatDate(f.updatedAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <form action={setFormStatus}>
                <input type="hidden" name="id" value={f.id} />
                <input
                  type="hidden"
                  name="status"
                  value={f.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {f.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </Button>
              </form>
              <Link
                href={`/admin/forms/${f.id}`}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Edit
              </Link>
              <form action={deleteForm}>
                <input type="hidden" name="id" value={f.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ))}
        {forms.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No forms yet — create one above.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
