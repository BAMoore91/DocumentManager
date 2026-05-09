import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { FormFillRunner } from "@/components/form-fill-runner";
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

      <FormFillRunner
        formId={form.id}
        formName={form.name}
        fields={form.fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder,
          options: f.options,
        }))}
      />

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
