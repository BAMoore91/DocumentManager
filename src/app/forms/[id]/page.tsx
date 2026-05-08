import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitForm } from "@/lib/actions/forms";
import { formatDate } from "@/lib/utils";

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default async function FillFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { position: "asc" } },
      submissions: {
        where: { userId: session.user.id },
        orderBy: { submittedAt: "desc" },
        take: 5,
      },
    },
  });
  if (!form || form.organizationId !== orgId) notFound();
  if (form.status !== "PUBLISHED") notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/forms"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← All forms
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{form.name}</h1>
        {form.description ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{form.description}</p>
        ) : null}
      </div>

      <Card>
        <form action={submitForm} className="space-y-4">
          <input type="hidden" name="formId" value={form.id} />
          {form.fields.map((field) => {
            const opts = field.options ? (JSON.parse(field.options) as string[]) : [];
            const name = `f_${field.id}`;
            const label = (
              <Label htmlFor={name}>
                {field.label}
                {field.required ? <span className="ml-1 text-red-600 dark:text-red-300">*</span> : null}
              </Label>
            );

            switch (field.type) {
              case "TEXT":
                return (
                  <div key={field.id}>
                    {label}
                    <Input
                      id={name}
                      name={name}
                      required={field.required}
                      placeholder={field.placeholder ?? undefined}
                      maxLength={2000}
                    />
                  </div>
                );
              case "TEXTAREA":
                return (
                  <div key={field.id}>
                    {label}
                    <Textarea
                      id={name}
                      name={name}
                      required={field.required}
                      placeholder={field.placeholder ?? undefined}
                      maxLength={10000}
                    />
                  </div>
                );
              case "NUMBER":
                return (
                  <div key={field.id}>
                    {label}
                    <Input
                      id={name}
                      name={name}
                      type="number"
                      step="any"
                      required={field.required}
                      placeholder={field.placeholder ?? undefined}
                    />
                  </div>
                );
              case "DATE":
                return (
                  <div key={field.id}>
                    {label}
                    <Input id={name} name={name} type="date" required={field.required} />
                  </div>
                );
              case "CHECKBOX":
                return (
                  <div key={field.id}>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" name={name} className="h-4 w-4" />
                      {field.label}
                      {field.required ? <span className="text-red-600 dark:text-red-300">*</span> : null}
                    </label>
                  </div>
                );
              case "CHECKBOXES":
                return (
                  <div key={field.id}>
                    {label}
                    <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                      {opts.length === 0 ? (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                          No options configured.
                        </span>
                      ) : (
                        opts.map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              name={name}
                              value={opt}
                              className="h-4 w-4"
                            />
                            {opt}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                );
              case "SELECT":
                return (
                  <div key={field.id}>
                    {label}
                    <Select id={name} name={name} required={field.required} defaultValue="">
                      <option value="" disabled>
                        Choose…
                      </option>
                      {opts.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              default:
                return null;
            }
          })}
          <Button type="submit">Submit</Button>
        </form>
      </Card>

      {form.submissions.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-[hsl(var(--border))] px-4 py-3">
            <h2 className="font-medium">My recent submissions</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Submitted</th>
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
                    {form.fields.map((f) => (
                      <td key={f.id} className="px-4 py-3">
                        {formatValue(values[f.id])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
