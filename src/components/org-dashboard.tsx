import { prisma } from "@/lib/db";
import { getOrgMetrics } from "@/lib/metrics";
import { MetricGrid } from "@/components/metric-grid";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { expirationStatus, formatDate } from "@/lib/utils";

export async function OrgDashboard({
  orgId,
  title = "Organization Dashboard",
  subtitle,
}: {
  orgId: string;
  title?: string;
  subtitle?: string;
}) {
  const [m, upcoming] = await Promise.all([
    getOrgMetrics(orgId),
    prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { expirationDate: "asc" },
      take: 10,
      include: { owner: { select: { name: true, email: true } } },
    }),
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
