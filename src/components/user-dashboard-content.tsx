import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserMetrics } from "@/lib/metrics";
import { getUserRequirementStatus, getUserTrainingStatus } from "@/lib/compliance";
import { MetricGrid } from "@/components/metric-grid";
import { DocumentTable } from "@/components/document-table";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

const statusStyles = {
  valid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  "expiring-soon": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  missing: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

const statusLabels = {
  valid: "Valid",
  "expiring-soon": "Expiring soon",
  expired: "Expired",
  missing: "Missing",
};

export async function UserDashboardContent({
  userId,
  title = "My Dashboard",
  subtitle = "Your certificates and document expirations.",
  uploadHref,
  complianceHeading = "My compliance",
}: {
  userId: string;
  title?: string;
  subtitle?: string;
  uploadHref?: string;
  complianceHeading?: string;
}) {
  const [m, upcoming, requirements, trainingStatuses] = await Promise.all([
    getUserMetrics(userId),
    prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { expirationDate: "asc" },
      take: 5,
    }),
    getUserRequirementStatus(userId),
    getUserTrainingStatus(userId),
  ]);

  const satisfied = requirements.filter(
    (r) => r.status === "valid" || r.status === "expiring-soon",
  ).length;
  const compliancePercent =
    requirements.length === 0
      ? 100
      : Math.round((satisfied / requirements.length) * 100);

  const trainingsSatisfied = trainingStatuses.filter(
    (t) => t.status === "valid" || t.status === "expiring-soon",
  ).length;
  const trainingCompliancePercent =
    trainingStatuses.length === 0
      ? 100
      : Math.round((trainingsSatisfied / trainingStatuses.length) * 100);

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
          { label: "Total Documents", value: m.total },
          { label: "Valid", value: m.valid, tone: "success" },
          { label: "Expired", value: m.expired, tone: "danger" },
          { label: "Expiring ≤ 90 Days", value: m.expiring90, tone: "warning" },
          { label: "Expiring ≤ 60 Days", value: m.expiring60, tone: "warning" },
          { label: "Expiring ≤ 30 Days", value: m.expiring30, tone: "danger" },
        ]}
      />

      {requirements.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Required documents</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Documents this role requires uploaded and kept current.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                {complianceHeading}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {compliancePercent}%
              </div>
            </div>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">File</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr
                    key={r.requiredDocumentId}
                    className="border-b border-[hsl(var(--border))] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusStyles[r.status],
                        )}
                      >
                        {statusLabels[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.document ? formatDate(r.document.expirationDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.document ? (
                        <Link
                          href={r.document.fileUrl}
                          target="_blank"
                          className="text-[hsl(var(--primary))] hover:underline"
                        >
                          {r.document.name}
                        </Link>
                      ) : uploadHref ? (
                        <Link
                          href={uploadHref}
                          className="text-[hsl(var(--primary))] hover:underline"
                        >
                          Upload →
                        </Link>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}

      {trainingStatuses.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Required training</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Courses this role requires completed and kept current.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                Training {complianceHeading.toLowerCase().replace(/^my /, "")}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {trainingCompliancePercent}%
              </div>
            </div>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {trainingStatuses.map((t) => (
                  <tr
                    key={t.courseId}
                    className="border-b border-[hsl(var(--border))] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusStyles[t.status],
                        )}
                      >
                        {statusLabels[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.latestRecord ? formatDate(t.latestRecord.completedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.latestRecord?.expiresAt
                        ? formatDate(t.latestRecord.expiresAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.latestRecord?.certificateUrl ? (
                        <Link
                          href={t.latestRecord.certificateUrl}
                          target="_blank"
                          className="text-[hsl(var(--primary))] hover:underline"
                        >
                          Download
                        </Link>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Next expirations</h2>
        <DocumentTable docs={upcoming} />
      </div>
    </div>
  );
}
