import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MetricGrid } from "@/components/metric-grid";
import { Card } from "@/components/ui/card";
import { getOrgCompliance } from "@/lib/compliance";

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}
function startOfNextYear(year: number) {
  return new Date(year + 1, 0, 1);
}

// 200,000 = OSHA standard for full-time-equivalent worker hours per year × 100
// TRIR = (recordable cases × 200,000) / hours worked
// DART = (cases with days away or restricted/transferred × 200,000) / hours worked
// We approximate hours worked = active members × 2,000 hr/year unless overridden.
const DEFAULT_FTE_HOURS = 2000;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; hours?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  if (session.user.role !== "ORG_ADMIN") redirect("/admin");
  const orgId = session.user.organizationId;

  const { year: yearParam, hours: hoursParam } = await searchParams;
  const now = new Date().getFullYear();
  const year = (() => {
    const n = Number(yearParam);
    if (!Number.isInteger(n) || n < 2000 || n > 2100) return now;
    return n;
  })();

  const yearStart = startOfYear(year);
  const yearEnd = startOfNextYear(year);

  const [
    activeMembers,
    incidents,
    capas,
    talks,
    ptps,
    audits,
    permits,
    trainings,
    compliance,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.incident.findMany({
      where: { organizationId: orgId, occurredAt: { gte: yearStart, lt: yearEnd } },
      select: { type: true, daysAway: true, daysRestricted: true },
    }),
    prisma.correctiveAction.groupBy({
      by: ["status"],
      where: { organizationId: orgId, createdAt: { gte: yearStart, lt: yearEnd } },
      _count: { _all: true },
    }),
    prisma.toolboxTalk.count({
      where: { organizationId: orgId, date: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.preTaskPlan.count({
      where: { organizationId: orgId, date: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.audit.count({
      where: { organizationId: orgId, conductedAt: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.permit.count({
      where: { organizationId: orgId, validFrom: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.trainingRecord.count({
      where: { organizationId: orgId, completedAt: { gte: yearStart, lt: yearEnd } },
    }),
    getOrgCompliance(orgId),
  ]);

  const recordable = incidents.filter((i) =>
    ["RECORDABLE", "RESTRICTED_DUTY", "LOST_TIME", "FATALITY"].includes(i.type),
  ).length;
  const dartCases = incidents.filter((i) =>
    ["RESTRICTED_DUTY", "LOST_TIME", "FATALITY"].includes(i.type),
  ).length;

  const overrideHours = (() => {
    const n = Number(hoursParam);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  })();
  const hoursWorked = overrideHours ?? activeMembers * DEFAULT_FTE_HOURS;

  const trir =
    hoursWorked > 0 ? Number(((recordable * 200000) / hoursWorked).toFixed(2)) : 0;
  const dart =
    hoursWorked > 0 ? Number(((dartCases * 200000) / hoursWorked).toFixed(2)) : 0;

  const capaOpen =
    capas.find((c) => c.status === "OPEN")?._count._all ??
    capas.find((c) => c.status === "IN_PROGRESS")?._count._all ??
    0;
  const capaClosed =
    (capas.find((c) => c.status === "CLOSED")?._count._all ?? 0) +
    (capas.find((c) => c.status === "VERIFIED")?._count._all ?? 0);

  const yearOptions = [now, now - 1, now - 2, now - 3];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Year-to-date safety metrics for {year}. TRIR and DART use OSHA's
          standard 200,000-hour denominator.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <div>
          <label className="mb-1 block text-xs uppercase text-[hsl(var(--muted-foreground))]">
            Year
          </label>
          <select
            name="year"
            defaultValue={String(year)}
            className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-[hsl(var(--muted-foreground))]">
            Hours worked (override)
          </label>
          <input
            type="number"
            name="hours"
            min={0}
            step={1000}
            defaultValue={overrideHours ?? ""}
            placeholder={`${activeMembers} × ${DEFAULT_FTE_HOURS}`}
            className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          Update
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Lagging indicators</h2>
        <MetricGrid
          metrics={[
            { label: "TRIR", value: trir.toString(), tone: trir > 3 ? "danger" : "default" },
            { label: "DART", value: dart.toString(), tone: dart > 1.5 ? "danger" : "default" },
            { label: "Recordables", value: recordable, tone: "danger" },
            { label: "Total cases", value: incidents.length },
          ]}
        />
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Hours worked: {hoursWorked.toLocaleString()}{" "}
          {overrideHours ? "(manual)" : `(${activeMembers} members × ${DEFAULT_FTE_HOURS} hr)`}
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Leading indicators</h2>
        <MetricGrid
          metrics={[
            { label: "Toolbox talks", value: talks },
            { label: "Pre-task plans", value: ptps },
            { label: "Audits", value: audits },
            { label: "Permits issued", value: permits },
          ]}
        />
        <div className="mt-3">
          <MetricGrid
            metrics={[
              { label: "Trainings completed", value: trainings },
              {
                label: "CAPAs open",
                value: capaOpen,
                tone: capaOpen > 0 ? "warning" : "default",
              },
              { label: "CAPAs closed", value: capaClosed, tone: "success" },
              {
                label: "Compliance %",
                value: `${compliance.compliancePercent}%`,
                tone:
                  compliance.compliancePercent === 100
                    ? "success"
                    : compliance.compliancePercent >= 75
                      ? "warning"
                      : "danger",
              },
            ]}
          />
        </div>
      </div>

      <Card>
        <h2 className="mb-2 font-medium">How TRIR / DART are calculated</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          TRIR = (recordable cases × 200,000) ÷ hours worked. DART includes only
          cases with days away from work or restricted duty / job transfer.
          OSHA's 200,000-hour denominator represents 100 full-time employees
          working 2,000 hours per year. The default hours-worked estimate uses
          all org members × 2,000; override above with payroll hours for a more
          accurate rate.
        </p>
      </Card>
    </div>
  );
}
