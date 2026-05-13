import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

function formatDateTime(d: Date) {
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseSinceDays(value: string | undefined): number | null {
  if (!value) return 30;
  if (value === "all") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(n, 365);
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string;
    action?: string;
    since?: string;
    page?: string;
    q?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const sp = await searchParams;

  const userFilter = sp.user ?? "";
  const actionFilter = sp.action ?? "";
  const sinceDays = parseSinceDays(sp.since);
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: orgId,
    ...(userFilter ? { userId: userFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
    ...(q ? { summary: { contains: q, mode: "insensitive" } } : {}),
  };

  const [logs, total, members, actionGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { organizationId: orgId },
      _count: { _all: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (userFilter) params.set("user", userFilter);
    if (actionFilter) params.set("action", actionFilter);
    if (sp.since) params.set("since", sp.since);
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `/admin/settings/logs?${s}` : "/admin/settings/logs";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Activity log</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Every recorded action in your organization — sign-ins, document
          uploads, member changes, hazard reports, and more.
        </p>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label htmlFor="user">User</Label>
            <Select id="user" name="user" defaultValue={userFilter}>
              <option value="">— Any user —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="action">Action</Label>
            <Select id="action" name="action" defaultValue={actionFilter}>
              <option value="">— Any action —</option>
              {actionGroups.map((g) => (
                <option key={g.action} value={g.action}>
                  {g.action} ({g._count._all})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="since">Since</Label>
            <Select id="since" name="since" defaultValue={sp.since ?? "30"}>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="q">Search summary</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="user name, document…" />
          </div>
          <div className="md:col-span-5 flex gap-2">
            <Button type="submit">Apply</Button>
            <Link
              href="/admin/settings/logs"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[hsl(var(--border))] px-4 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="text-sm text-[hsl(var(--muted-foreground))]">
        {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
        {sinceDays ? ` · last ${sinceDays} days` : " · all time"}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-xs">
                  {formatDateTime(l.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {l.user ? (l.user.name ?? l.user.email) : (
                    <span className="text-[hsl(var(--muted-foreground))]">system</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-3">{l.summary}</td>
                <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {l.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No activity matches this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={page > 1 ? buildHref({ page: String(page - 1) }) : "#"}
              className={cn(
                "inline-flex h-9 items-center rounded-md border border-[hsl(var(--border))] px-3 text-sm",
                page > 1
                  ? "hover:bg-[hsl(var(--muted))]"
                  : "pointer-events-none opacity-50",
              )}
            >
              ← Prev
            </Link>
            <Link
              href={page < totalPages ? buildHref({ page: String(page + 1) }) : "#"}
              className={cn(
                "inline-flex h-9 items-center rounded-md border border-[hsl(var(--border))] px-3 text-sm",
                page < totalPages
                  ? "hover:bg-[hsl(var(--muted))]"
                  : "pointer-events-none opacity-50",
              )}
            >
              Next →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
