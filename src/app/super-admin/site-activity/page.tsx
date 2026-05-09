import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { MetricGrid } from "@/components/metric-grid";

function formatDateTime(d: Date) {
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shortDay(key: string) {
  const d = new Date(key + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function browserFromUA(ua: string | null): string {
  if (!ua) return "Unknown";
  const u = ua.toLowerCase();
  if (u.includes("edg/")) return "Edge";
  if (u.includes("opr/") || u.includes("opera")) return "Opera";
  if (u.includes("chrome/")) return "Chrome";
  if (u.includes("firefox/")) return "Firefox";
  if (u.includes("safari/")) return "Safari";
  return "Other";
}

function osFromUA(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

function hostFromReferrer(ref: string | null): string {
  if (!ref) return "Direct";
  try {
    return new URL(ref).host || "Direct";
  } catch {
    return "Other";
  }
}

const SINCE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
];

export default async function SiteActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const sp = await searchParams;
  const sinceParam = sp.since ?? "30";
  const sinceDays =
    sinceParam === "all"
      ? null
      : Math.min(365, Math.max(1, Number.parseInt(sinceParam, 10) || 30));
  const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;
  const where = sinceDate ? { createdAt: { gte: sinceDate } } : {};

  const [
    visits,
    totalVisits,
    sessionGroups,
    contactCount,
    recentVisits,
  ] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        sessionId: true,
        path: true,
        referrer: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.siteVisit.count({ where }),
    prisma.siteVisit.groupBy({
      by: ["sessionId"],
      where,
      _count: { _all: true },
    }),
    prisma.contactSubmission.count(
      sinceDate ? { where: { createdAt: { gte: sinceDate } } } : undefined,
    ),
    prisma.siteVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const uniqueSessions = sessionGroups.length;
  const conversion =
    uniqueSessions === 0
      ? 0
      : Math.round((contactCount / uniqueSessions) * 1000) / 10;

  // Per-day counts
  const days = new Map<string, { visits: number; sessions: Set<string> }>();
  const buckets = sinceDays ?? 30;
  for (let i = 0; i < Math.min(buckets, 60); i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.set(dayKey(d), { visits: 0, sessions: new Set() });
  }
  for (const v of visits) {
    const k = dayKey(v.createdAt);
    if (!days.has(k)) {
      days.set(k, { visits: 0, sessions: new Set() });
    }
    const bucket = days.get(k)!;
    bucket.visits += 1;
    bucket.sessions.add(v.sessionId);
  }
  const dayRows = Array.from(days.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => ({
      key: k,
      visits: v.visits,
      uniques: v.sessions.size,
    }));
  const maxDayVisits = Math.max(1, ...dayRows.map((r) => r.visits));

  // Top referrers
  const refCounts = new Map<string, number>();
  for (const v of visits) {
    const host = hostFromReferrer(v.referrer);
    refCounts.set(host, (refCounts.get(host) ?? 0) + 1);
  }
  const topRefs = Array.from(refCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Top paths
  const pathCounts = new Map<string, number>();
  for (const v of visits) {
    pathCounts.set(v.path, (pathCounts.get(v.path) ?? 0) + 1);
  }
  const topPaths = Array.from(pathCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Browser / OS breakdown
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  for (const v of visits) {
    const b = browserFromUA(v.userAgent);
    const o = osFromUA(v.userAgent);
    browserCounts.set(b, (browserCounts.get(b) ?? 0) + 1);
    osCounts.set(o, (osCounts.get(o) ?? 0) + 1);
  }
  const browsers = Array.from(browserCounts.entries()).sort((a, b) => b[1] - a[1]);
  const oss = Array.from(osCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site activity</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Visitor analytics for the public marketing site. Counts only include
          visitors who accepted analytics cookies.
        </p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Window</label>
            <select
              name="since"
              defaultValue={sinceParam}
              className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
            >
              {SINCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Apply
          </button>
        </form>
      </Card>

      <MetricGrid
        metrics={[
          { label: "Page views", value: totalVisits },
          { label: "Unique sessions", value: uniqueSessions },
          { label: "Contact requests", value: contactCount },
          { label: "Conversion rate", value: `${conversion}%` },
        ]}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Visits by day</h2>
        <Card className="p-4">
          {dayRows.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No traffic in this window yet.
            </p>
          ) : (
            <div className="flex h-48 items-end gap-1">
              {dayRows.map((r) => (
                <div
                  key={r.key}
                  className="group flex flex-1 flex-col items-center justify-end"
                  title={`${shortDay(r.key)} — ${r.visits} views, ${r.uniques} unique`}
                >
                  <div
                    className="w-full rounded-t bg-[hsl(var(--primary))] transition group-hover:opacity-80"
                    style={{
                      height: `${(r.visits / maxDayVisits) * 100}%`,
                      minHeight: r.visits > 0 ? 2 : 0,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          {dayRows.length > 0 ? (
            <div className="mt-2 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>{shortDay(dayRows[0].key)}</span>
              <span>{shortDay(dayRows[dayRows.length - 1].key)}</span>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium">Top referrers</h3>
          <BreakdownTable rows={topRefs} total={totalVisits} />
        </Card>
        <Card>
          <h3 className="mb-3 font-medium">Top pages</h3>
          <BreakdownTable rows={topPaths} total={totalVisits} />
        </Card>
        <Card>
          <h3 className="mb-3 font-medium">Browsers</h3>
          <BreakdownTable rows={browsers} total={totalVisits} />
        </Card>
        <Card>
          <h3 className="mb-3 font-medium">Operating systems</h3>
          <BreakdownTable rows={oss} total={totalVisits} />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent visits</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">Browser</th>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[hsl(var(--border))] last:border-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {formatDateTime(v.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{v.path}</td>
                  <td className="px-4 py-3 text-xs">
                    {hostFromReferrer(v.referrer)}
                  </td>
                  <td className="px-4 py-3 text-xs">{browserFromUA(v.userAgent)}</td>
                  <td className="px-4 py-3 text-xs">{osFromUA(v.userAgent)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {v.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
              {recentVisits.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                  >
                    No visits yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        See related:{" "}
        <Link
          href="/super-admin/contact-submissions"
          className="text-[hsl(var(--primary))] hover:underline"
        >
          Contact submissions
        </Link>
      </p>
    </div>
  );
}

function BreakdownTable({
  rows,
  total,
}: {
  rows: [string, number][];
  total: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">No data.</p>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map(([label, count]) => {
        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <li key={label}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" title={label}>
                {label}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                {count.toLocaleString()} · {pct}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--primary))]"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
