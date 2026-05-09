import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrgMetrics } from "@/lib/metrics";
import { getOrgCompliance, getOrgTrainingCompliance } from "@/lib/compliance";
import { MetricGrid } from "@/components/metric-grid";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { cn, expirationStatus, formatDate } from "@/lib/utils";

export async function OrgDashboard({
  orgId,
  title = "Organization Dashboard",
  subtitle,
  userLinkBasePath,
}: {
  orgId: string;
  title?: string;
  subtitle?: string;
  userLinkBasePath?: string;
}) {
  const [m, upcoming, compliance, trainingCompliance] = await Promise.all([
    getOrgMetrics(orgId),
    prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { expirationDate: "asc" },
      take: 10,
      include: { owner: { select: { name: true, email: true } } },
    }),
    getOrgCompliance(orgId),
    getOrgTrainingCompliance(orgId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p>
        ) : null}
      </div>

      <MetricGrid
        metrics={[
          { label: "Org Admins", value: m.admins },
          { label: "Users", value: m.users },
          { label: "Total Documents", value: m.total },
          { label: "Valid", value: m.valid, tone: "success" },
        ]}
      />

      <MetricGrid
        metrics={[
          { label: "Expiring ≤ 90 Days", value: m.expiring90, tone: "warning" },
          { label: "Expiring ≤ 60 Days", value: m.expiring60, tone: "warning" },
          { label: "Expiring ≤ 30 Days", value: m.expiring30, tone: "danger" },
          { label: "Expired", value: m.expired, tone: "danger" },
        ]}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Document compliance</h2>
        <MetricGrid
          metrics={[
            {
              label: "Users in compliance",
              value: `${compliance.compliancePercent}%`,
              tone:
                compliance.compliancePercent === 100
                  ? "success"
                  : compliance.compliancePercent >= 75
                    ? "warning"
                    : "danger",
            },
            {
              label: "Compliant users",
              value: `${compliance.compliantUsers} / ${compliance.applicableUsers}`,
            },
            { label: "With requirements", value: compliance.applicableUsers },
            { label: "Total members", value: compliance.totalUsers },
          ]}
        />

        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Required</th>
                <th className="px-4 py-3">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {compliance.users.map((u) => (
                <tr
                  key={u.userId}
                  className="border-b border-[hsl(var(--border))] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {userLinkBasePath ? (
                      <Link
                        href={`${userLinkBasePath}/${u.userId}`}
                        className="hover:underline"
                      >
                        {u.name ?? u.email}
                      </Link>
                    ) : (
                      (u.name ?? u.email)
                    )}
                  </td>
                  <td className="px-4 py-3">{u.customRoleName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.required === 0 ? (
                      <span className="text-[hsl(var(--muted-foreground))]">N/A</span>
                    ) : (
                      `${u.satisfied} / ${u.required}`
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.required === 0 ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        No requirements
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                          <div
                            className={cn(
                              "h-full",
                              u.percent === 100
                                ? "bg-emerald-500"
                                : u.percent >= 75
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                            style={{ width: `${u.percent}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{u.percent}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {compliance.users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                  >
                    No members yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Training compliance</h2>
        <MetricGrid
          metrics={[
            {
              label: "Users in compliance",
              value: `${trainingCompliance.compliancePercent}%`,
              tone:
                trainingCompliance.compliancePercent === 100
                  ? "success"
                  : trainingCompliance.compliancePercent >= 75
                    ? "warning"
                    : "danger",
            },
            {
              label: "Trained users",
              value: `${trainingCompliance.compliantUsers} / ${trainingCompliance.applicableUsers}`,
            },
            { label: "With training", value: trainingCompliance.applicableUsers },
            { label: "Total members", value: trainingCompliance.totalUsers },
          ]}
        />

        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Required</th>
                <th className="px-4 py-3">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {trainingCompliance.users.map((u) => (
                <tr
                  key={u.userId}
                  className="border-b border-[hsl(var(--border))] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {userLinkBasePath ? (
                      <Link
                        href={`${userLinkBasePath}/${u.userId}`}
                        className="hover:underline"
                      >
                        {u.name ?? u.email}
                      </Link>
                    ) : (
                      (u.name ?? u.email)
                    )}
                  </td>
                  <td className="px-4 py-3">{u.customRoleName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.required === 0 ? (
                      <span className="text-[hsl(var(--muted-foreground))]">N/A</span>
                    ) : (
                      `${u.satisfied} / ${u.required}`
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.required === 0 ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        No required training
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                          <div
                            className={cn(
                              "h-full",
                              u.percent === 100
                                ? "bg-emerald-500"
                                : u.percent >= 75
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                            style={{ width: `${u.percent}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{u.percent}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {trainingCompliance.users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                  >
                    No members yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Next 10 expirations</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((d) => (
                <tr key={d.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">{d.type}</td>
                  <td className="px-4 py-3">{d.owner.name ?? d.owner.email}</td>
                  <td className="px-4 py-3">{formatDate(d.expirationDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expirationStatus(d.expirationDate)} />
                  </td>
                </tr>
              ))}
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                    No documents yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
