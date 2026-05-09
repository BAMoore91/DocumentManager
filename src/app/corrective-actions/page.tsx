import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { CapaPriorityBadge, CapaStatusBadge } from "@/components/capa-badges";
import { cn, formatDate } from "@/lib/utils";
import type { CorrectiveActionStatus, Prisma } from "@prisma/client";

type Filter = "ALL" | CorrectiveActionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "VERIFIED", label: "Verified" },
  { value: "CLOSED", label: "Closed" },
];

function parseFilter(v: string | undefined): Filter {
  if (v === "OPEN" || v === "IN_PROGRESS" || v === "VERIFIED" || v === "CLOSED") return v;
  return "ALL";
}

export default async function CapaListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { status: statusParam } = await searchParams;
  const filter = parseFilter(statusParam);

  const where: Prisma.CorrectiveActionWhereInput = {
    organizationId: orgId,
    ...(filter === "ALL" ? {} : { status: filter }),
  };

  const capas = await prisma.correctiveAction.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      assignedTo: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Corrective Actions</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Track action items raised from JHAs, incidents, audits, and
            observations through to verification.
          </p>
        </div>
        <Link
          href="/corrective-actions/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          New action
        </Link>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5 text-xs">
        {FILTERS.map(({ value, label }) => (
          <Link
            key={value}
            href={value === "ALL" ? "/corrective-actions" : `/corrective-actions?status=${value}`}
            className={cn(
              "rounded px-2 py-1",
              filter === value
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {capas.map((c) => {
              const overdue =
                c.dueDate &&
                c.status !== "CLOSED" &&
                c.status !== "VERIFIED" &&
                c.dueDate < today;
              return (
                <tr key={c.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/corrective-actions/${c.id}`} className="hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {c.sourceType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <CapaPriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <CapaStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    {c.assignedTo ? c.assignedTo.name ?? c.assignedTo.email : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 whitespace-nowrap",
                      overdue && "text-red-600 dark:text-red-300",
                    )}
                  >
                    {c.dueDate ? formatDate(c.dueDate) : "—"}
                    {overdue ? " · overdue" : ""}
                  </td>
                </tr>
              );
            })}
            {capas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No corrective actions match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
