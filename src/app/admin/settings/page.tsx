import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomRole, deleteCustomRole } from "@/lib/actions/custom-roles";
import {
  createRequiredDocument,
  deleteRequiredDocument,
  setRequiredDocumentRoles,
} from "@/lib/actions/required-documents";
import { createForm, deleteForm, setFormStatus } from "@/lib/actions/forms";
import { cn, formatDate } from "@/lib/utils";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [org, customRoles, requiredDocs, forms] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    }),
    prisma.customRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.requiredDocument.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        customRoles: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.form.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { fields: true, submissions: true } },
      },
    }),
  ]);

  if (!org) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Manage settings for {org.name}.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Custom roles</h2>
        <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
          Add job titles for your members (Foreman, Crew Leader, Safety Officer, etc.).
          These are labels — they don't change what someone can do, which is controlled
          by the system role (Org Admin or User).
        </p>

        <form
          action={createCustomRole}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="organizationId" value={orgId} />
          <div className="flex-1">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" name="name" required maxLength={60} placeholder="Foreman" />
          </div>
          <Button type="submit">Add role</Button>
        </form>

        <div className="mt-6 divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
          {customRoles.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {r._count.users} {r._count.users === 1 ? "member" : "members"}
                </span>
              </div>
              <form action={deleteCustomRole}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          ))}
          {customRoles.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No custom roles yet — add one above.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Required documents</h2>
        <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
          Define documents members must upload, and assign each one to the roles it
          applies to. Members in those roles will see them as required on their
          dashboard, and compliance is tracked per user and across the organization.
        </p>

        {customRoles.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Add at least one custom role above before defining required documents.
          </p>
        ) : (
          <form action={createRequiredDocument} className="space-y-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label htmlFor="req-name">Document name</Label>
              <Input id="req-name" name="name" required maxLength={100} placeholder="OSHA-10" />
            </div>
            <div>
              <Label>Applies to roles</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                {customRoles.map((r) => (
                  <label
                    key={r.id}
                    className="inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="customRoleIds"
                      value={r.id}
                      className="h-4 w-4"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit">Add required document</Button>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {requiredDocs.map((rd) => {
            const assignedIds = new Set(rd.customRoles.map((r) => r.id));
            return (
              <div
                key={rd.id}
                className="rounded-md border border-[hsl(var(--border))] p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{rd.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {rd._count.documents} uploaded
                    </div>
                  </div>
                  <form action={deleteRequiredDocument}>
                    <input type="hidden" name="id" value={rd.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>

                <form
                  action={setRequiredDocumentRoles}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="id" value={rd.id} />
                  <div className="flex-1">
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Applies to
                    </Label>
                    <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                      {customRoles.length === 0 ? (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                          No custom roles defined.
                        </span>
                      ) : (
                        customRoles.map((cr) => (
                          <label
                            key={cr.id}
                            className="inline-flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              name="customRoleIds"
                              value={cr.id}
                              defaultChecked={assignedIds.has(cr.id)}
                              className="h-4 w-4"
                            />
                            {cr.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <Button type="submit" variant="secondary" size="sm">
                    Save roles
                  </Button>
                </form>
              </div>
            );
          })}
          {requiredDocs.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No required documents yet.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Forms</h2>
        <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
          Build custom fillable forms for your members — daily checklists, incident
          reports, sign-offs, etc. Save as a draft, add fields, then publish so users
          can fill them from the Forms menu.
        </p>

        <form action={createForm} className="space-y-3">
          <input type="hidden" name="organizationId" value={orgId} />
          <div>
            <Label htmlFor="form-name">Form name</Label>
            <Input id="form-name" name="name" required maxLength={120} placeholder="Daily safety checklist" />
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

        <div className="mt-6 space-y-2">
          {forms.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
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
                  {f._count.submissions} submission{f._count.submissions === 1 ? "" : "s"} ·
                  Updated {formatDate(f.updatedAt)}
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
            </div>
          ))}
          {forms.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No forms yet — create one above.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
