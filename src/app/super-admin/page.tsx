import { prisma } from "@/lib/db";
import { getSuperAdminMetrics, getDocumentBuckets } from "@/lib/metrics";
import { MetricGrid } from "@/components/metric-grid";
import { Card } from "@/components/ui/card";

export default async function SuperAdminDashboard() {
  const m = await getSuperAdminMetrics();

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { users: true, documents: true } } },
  });

  const orgBuckets = await Promise.all(orgs.map((o) => getDocumentBuckets(o.id).then((b) => ({ org: o, b }))));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Cross-organization metrics for all certificates and documents.
        </p>
      </div>

      <MetricGrid
        metrics={[
          { label: "Organizations", value: m.organizations },
          { label: "Org Admins", value: m.totalAdmins },
          { label: "Users", value: m.totalUsers },
          { label: "Total Documents", value: m.total },
        ]}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Document Status</h2>
        <MetricGrid
          metrics={[
            { label: "Valid", value: m.valid, tone: "success" },
            { label: "Expiring ≤ 90 Days", value: m.expiring90, tone: "warning" },
            { label: "Expiring ≤ 60 Days", value: m.expiring60, tone: "warning" },
            { label: "Expiring ≤ 30 Days", value: m.expiring30, tone: "danger" },
          ]}
        />
        <div className="mt-3">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Expired</span>
              <span className="text-xl font-semibold text-red-600 dark:text-red-300">{m.expired}</span>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Per-Organization Breakdown</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Valid</th>
                <th className="px-4 py-3">≤90d</th>
                <th className="px-4 py-3">≤60d</th>
                <th className="px-4 py-3">≤30d</th>
                <th className="px-4 py-3">Expired</th>
              </tr>
            </thead>
            <tbody>
              {orgBuckets.map(({ org, b }) => (
                <tr key={org.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{org.name}</td>
                  <td className="px-4 py-3">{org._count.users}</td>
                  <td className="px-4 py-3">{b.total}</td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-300">{b.valid}</td>
                  <td className="px-4 py-3 text-yellow-600 dark:text-yellow-300">{b.expiring90}</td>
                  <td className="px-4 py-3 text-amber-600 dark:text-amber-300">{b.expiring60}</td>
                  <td className="px-4 py-3 text-orange-600 dark:text-orange-300">{b.expiring30}</td>
                  <td className="px-4 py-3 text-red-600 dark:text-red-300">{b.expired}</td>
                </tr>
              ))}
              {orgBuckets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                    No organizations yet — create one to get started.
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
