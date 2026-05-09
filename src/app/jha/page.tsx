import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SeverityBadge, JhaStatusBadge } from "@/components/jha-badges";
import { cn, formatDate } from "@/lib/utils";
import { Camera } from "lucide-react";
import type { JhaStatus, Prisma } from "@prisma/client";

type Filter = "ALL" | JhaStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
];

function parseFilter(v: string | undefined): Filter {
  if (v === "OPEN" || v === "IN_PROGRESS" || v === "RESOLVED") return v;
  return "ALL";
}

export default async function JhaListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { status: statusParam } = await searchParams;
  const filter = parseFilter(statusParam);

  const where: Prisma.JhaReportWhereInput = {
    organizationId: orgId,
    ...(filter === "ALL" ? {} : { status: filter }),
  };

  const reports = await prisma.jhaReport.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reportedBy: { select: { name: true, email: true } },
      _count: { select: { photos: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">JHA — Jobsite Hazards</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Report and track jobsite hazards. Anyone can submit; Org Admins
            update status as hazards are addressed.
          </p>
        </div>
        <Link
          href="/jha/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          Report a hazard
        </Link>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5 text-xs">
        {FILTERS.map(({ value, label }) => (
          <Link
            key={value}
            href={value === "ALL" ? "/jha" : `/jha?status=${value}`}
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

      <div className="space-y-2">
        {reports.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/jha/${r.id}`} className="font-medium hover:underline">
                  {r.title}
                </Link>
                <SeverityBadge severity={r.severity} />
                <JhaStatusBadge status={r.status} />
                {r._count.photos > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Camera className="h-3 w-3" />
                    {r._count.photos}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {r.location ? `${r.location} · ` : ""}
                Reported by {r.reportedBy.name ?? r.reportedBy.email} ·{" "}
                {formatDate(r.createdAt)}
              </div>
            </div>
            <Link
              href={`/jha/${r.id}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Open
            </Link>
          </Card>
        ))}
        {reports.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {filter === "ALL"
                ? "No hazard reports yet."
                : "No reports match this filter."}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
