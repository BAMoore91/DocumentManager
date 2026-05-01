import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserMetrics } from "@/lib/metrics";
import { MetricGrid } from "@/components/metric-grid";
import { DocumentTable } from "@/components/document-table";

export default async function UserDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const m = await getUserMetrics(userId);
  const upcoming = await prisma.document.findMany({
    where: { ownerId: userId },
    orderBy: { expirationDate: "asc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Your certificates and document expirations.
        </p>
      </div>

      <MetricGrid
        metrics={[
          { label: "Total Documents", value: m.total },
          { label: "Valid", value: m.valid, tone: "success" },
          { label: "Expired", value: m.expired, tone: "danger" },
          { label: "Expiring ≤ 90 Days", value: m.expiring90, tone: "warning" },
          { label: "Expiring ≤ 60 Days", value: m.expiring60, tone: "warning" },
          { label: "Expiring ≤ 30 Days", value: m.expiring30, tone: "danger" },
        ]}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Next expirations</h2>
        <DocumentTable docs={upcoming} />
      </div>
    </div>
  );
}
