import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

export default async function PtpListPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const ptps = await prisma.preTaskPlan.findMany({
    where: { organizationId: orgId },
    orderBy: [{ date: "desc" }],
    include: {
      createdBy: { select: { name: true, email: true } },
      site: { select: { name: true } },
      _count: { select: { acknowledgements: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pre-Task Plans</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Daily, task-specific plans crews acknowledge before starting work.
          </p>
        </div>
        <Link
          href="/ptp/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          New plan
        </Link>
      </div>

      <div className="space-y-2">
        {ptps.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/ptp/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    STATUS_STYLES[p.status],
                  )}
                >
                  {p.status}
                </span>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatDate(p.date)} · {p.createdBy.name ?? p.createdBy.email}
                {p.site ? ` · ${p.site.name}` : ""}
                {" · "}
                {p._count.acknowledgements} acknowledgement
                {p._count.acknowledgements === 1 ? "" : "s"}
              </div>
            </div>
            <Link
              href={`/ptp/${p.id}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-xs hover:bg-[hsl(var(--muted))]"
            >
              Open
            </Link>
          </Card>
        ))}
        {ptps.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No pre-task plans yet.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
