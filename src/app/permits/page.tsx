import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  HOT_WORK: "Hot work",
  CONFINED_SPACE: "Confined space",
  LOCKOUT_TAGOUT: "Lockout / tagout",
  WORKING_AT_HEIGHTS: "Working at heights",
  ELECTRICAL: "Electrical",
  EXCAVATION: "Excavation",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  ISSUED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  CLOSED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

export default async function PermitsListPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ORG_ADMIN";

  const permits = await prisma.permit.findMany({
    where: { organizationId: orgId },
    orderBy: [{ status: "asc" }, { validUntil: "asc" }],
    include: {
      issuedBy: { select: { name: true, email: true } },
      recipient: { select: { name: true, email: true } },
      site: { select: { name: true } },
    },
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Permits-to-Work</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Authorize and time-bound high-risk work — hot work, confined space,
            LOTO, working at heights.
          </p>
        </div>
        {isAdmin ? (
          <Link
            href="/permits/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Issue permit
          </Link>
        ) : null}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Valid window</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p) => {
              const expired = p.status === "ISSUED" && p.validUntil < today;
              return (
                <tr key={p.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/permits/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABELS[p.type] ?? p.type}</td>
                  <td className="px-4 py-3">{p.site?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.recipient
                      ? p.recipient.name ?? p.recipient.email
                      : p.recipientName ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {formatDate(p.validFrom)} – {formatDate(p.validUntil)}
                    {expired ? (
                      <span className="ml-1 text-red-600 dark:text-red-300">
                        · expired
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[p.status],
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {permits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No permits issued yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
