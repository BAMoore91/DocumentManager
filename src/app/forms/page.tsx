import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function FormsListPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const forms = await prisma.form.findMany({
    where: { organizationId: orgId, status: "PUBLISHED" },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { fields: true } },
      submissions: {
        where: { userId: session.user.id },
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { submittedAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Fillable forms published by your organization.
        </p>
      </div>

      <div className="space-y-2">
        {forms.map((f) => {
          const last = f.submissions[0];
          return (
            <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/forms/${f.id}`} className="font-medium hover:underline">
                  {f.name}
                </Link>
                {f.description ? (
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {f.description}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {f._count.fields} field{f._count.fields === 1 ? "" : "s"}
                  {last ? ` · last submitted ${formatDate(last.submittedAt)}` : ""}
                </div>
              </div>
              <Link
                href={`/forms/${f.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
              >
                Open
              </Link>
            </Card>
          );
        })}
        {forms.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No published forms yet.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
