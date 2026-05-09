import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { MetricGrid } from "@/components/metric-grid";
import { IncidentTypeBadge, IncidentStatusBadge } from "@/components/incident-badges";
import { cn, formatDate } from "@/lib/utils";
import { Camera } from "lucide-react";
import type { IncidentStatus, Prisma } from "@prisma/client";

type Filter = "ALL" | IncidentStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "CLOSED", label: "Closed" },
];

function parseFilter(v: string | undefined): Filter {
  if (v === "OPEN" || v === "UNDER_REVIEW" || v === "CLOSED") return v;
  return "ALL";
}

function parseYear(v: string | undefined): number {
  const now = new Date().getFullYear();
  if (!v) return now;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return now;
  return n;
}

export default async function IncidentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { year: yearParam, status: statusParam } = await searchParams;
  const year = parseYear(yearParam);
  const filter = parseFilter(statusParam);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const where: Prisma.IncidentWhereInput = {
    organizationId: orgId,
    occurredAt: { gte: yearStart, lt: yearEnd },
    ...(filter === "ALL" ? {} : { status: filter }),
  };

  const [incidents, allYearIncidents] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        reportedBy: { select: { name: true, email: true } },
        personInvolved: { select: { name: true, email: true } },
        _count: { select: { photos: true } },
      },
    }),
    prisma.incident.findMany({
      where: {
        organizationId: orgId,
        occurredAt: { gte: yearStart, lt: yearEnd },
      },
      select: { type: true, daysAway: true, daysRestricted: true },
    }),
  ]);

  const summary = {
    total: allYearIncidents.length,
    nearMiss: allYearIncidents.filter((i) => i.type === "NEAR_MISS").length,
    firstAid: allYearIncidents.filter((i) => i.type === "FIRST_AID").length,
    recordable: allYearIncidents.filter((i) =>
      ["RECORDABLE", "RESTRICTED_DUTY", "LOST_TIME", "FATALITY"].includes(i.type),
    ).length,
    daysAway: allYearIncidents.reduce((s, i) => s + (i.daysAway ?? 0), 0),
    daysRestricted: allYearIncidents.reduce((s, i) => s + (i.daysRestricted ?? 0), 0),
    fatalities: allYearIncidents.filter((i) => i.type === "FATALITY").length,
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Log work-related injuries, illnesses, and near-misses. Year-to-date
            counts mirror the OSHA Form 300A summary.
          </p>
        </div>
        <Link
          href="/incidents/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          Report incident
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">Year:</span>
          <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5 text-xs">
            {yearOptions.map((y) => {
              const href =
                filter === "ALL"
                  ? `/incidents?year=${y}`
                  : `/incidents?year=${y}&status=${filter}`;
              return (
                <Link
                  key={y}
                  href={href}
                  className={cn(
                    "rounded px-2 py-1",
                    year === y
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  {y}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">Status:</span>
          <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5 text-xs">
            {FILTERS.map(({ value, label }) => {
              const href =
                value === "ALL"
                  ? `/incidents?year=${year}`
                  : `/incidents?year=${year}&status=${value}`;
              return (
                <Link
                  key={value}
                  href={href}
                  className={cn(
                    "rounded px-2 py-1",
                    filter === value
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{year} summary</h2>
        <MetricGrid
          metrics={[
            { label: "Total cases", value: summary.total },
            { label: "Recordable", value: summary.recordable, tone: "danger" },
            { label: "First aid", value: summary.firstAid, tone: "warning" },
            { label: "Near misses", value: summary.nearMiss },
          ]}
        />
        <div className="mt-3">
          <MetricGrid
            metrics={[
              { label: "Days away", value: summary.daysAway, tone: "danger" },
              {
                label: "Days restricted",
                value: summary.daysRestricted,
                tone: "warning",
              },
              {
                label: "Fatalities",
                value: summary.fatalities,
                tone: summary.fatalities > 0 ? "danger" : "default",
              },
              { label: "Open cases", value: incidents.filter((i) => i.status === "OPEN").length },
            ]}
          />
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Case #</th>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(i.occurredAt)}</td>
                <td className="px-4 py-3 tabular-nums">{i.caseNumber ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/incidents/${i.id}`} className="font-medium hover:underline">
                    {i.personName}
                  </Link>
                  {i._count.photos > 0 ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <Camera className="h-3 w-3" />
                      {i._count.photos}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <IncidentTypeBadge type={i.type} />
                </td>
                <td className="px-4 py-3">
                  <IncidentStatusBadge status={i.status} />
                </td>
                <td className="px-4 py-3">{i.location ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/incidents/${i.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-xs hover:bg-[hsl(var(--muted))]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {incidents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                >
                  {filter === "ALL"
                    ? `No incidents recorded in ${year}.`
                    : "No incidents match this filter."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
