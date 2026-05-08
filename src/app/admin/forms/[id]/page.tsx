import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteFormField, setFormStatus, updateForm } from "@/lib/actions/forms";
import { AddFormFieldForm } from "@/components/add-form-field-form";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Short text",
  TEXTAREA: "Long text",
  NUMBER: "Number",
  DATE: "Date",
  CHECKBOX: "Single checkbox",
  CHECKBOXES: "Multiple choice",
  SELECT: "Dropdown",
};

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { position: "asc" } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!form || form.organizationId !== session.user.organizationId) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings/forms"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Forms
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{form.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {form.status === "PUBLISHED" ? "Published" : "Draft"} · {form.fields.length}{" "}
            field{form.fields.length === 1 ? "" : "s"} · {form.submissions.length}{" "}
            submission{form.submissions.length === 1 ? "" : "s"}
          </p>
        </div>
        <form action={setFormStatus}>
          <input type="hidden" name="id" value={form.id} />
          <input
            type="hidden"
            name="status"
            value={form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
          />
          <Button type="submit" variant={form.status === "PUBLISHED" ? "secondary" : "primary"}>
            {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Form details</h2>
        <form action={updateForm} className="space-y-3">
          <input type="hidden" name="id" value={form.id} />
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={form.name} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={form.description ?? ""}
              maxLength={2000}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Save details
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Fields</h2>
        <div className="space-y-2">
          {form.fields.map((f, i) => {
            const opts = f.options ? (JSON.parse(f.options) as string[]) : [];
            return (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {i + 1}. {f.label}
                    {f.required ? (
                      <span className="ml-2 text-xs text-red-600 dark:text-red-300">
                        required
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {TYPE_LABELS[f.type] ?? f.type}
                    {opts.length > 0 ? ` · options: ${opts.join(", ")}` : ""}
                  </div>
                </div>
                <form action={deleteFormField}>
                  <input type="hidden" name="id" value={f.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Remove
                  </Button>
                </form>
              </div>
            );
          })}
          {form.fields.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No fields yet — add one below.
            </p>
          ) : null}
        </div>

        <div className="mt-6 border-t border-[hsl(var(--border))] pt-6">
          <h3 className="mb-3 text-sm font-medium">Add a field</h3>
          <AddFormFieldForm formId={form.id} />
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <h2 className="font-medium">Submissions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">User</th>
              {form.fields.map((f) => (
                <th key={f.id} className="px-4 py-3">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.submissions.map((s) => {
              const values = (s.values ?? {}) as Record<string, unknown>;
              return (
                <tr key={s.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.submittedAt)}</td>
                  <td className="px-4 py-3">{s.user.name ?? s.user.email}</td>
                  {form.fields.map((f) => (
                    <td key={f.id} className="px-4 py-3">
                      {formatValue(values[f.id])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {form.submissions.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + form.fields.length}
                  className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                >
                  No submissions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
