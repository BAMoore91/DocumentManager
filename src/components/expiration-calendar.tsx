import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { cn, expirationStatus } from "@/lib/utils";
import type { ExpirationStatus } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const chipStyles: Record<ExpirationStatus, string> = {
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  "expiring-30": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  "expiring-60": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "expiring-90": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  valid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function parseMonth(m: string | undefined): { year: number; monthIndex: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) return { year: y, monthIndex: mo - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function shiftMonth(year: number, monthIndex: number, by: number) {
  const d = new Date(year, monthIndex + by, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function ExpirationCalendar({
  orgId,
  monthParam: m,
  basePath,
}: {
  orgId: string;
  monthParam?: string;
  basePath: string;
}) {
  const { year, monthIndex } = parseMonth(m);
  const monthStart = new Date(year, monthIndex, 1);

  const firstCell = new Date(monthStart);
  firstCell.setDate(firstCell.getDate() - firstCell.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCell);
    d.setDate(firstCell.getDate() + i);
    cells.push(d);
  }

  const queryEnd = new Date(cells[cells.length - 1]);
  queryEnd.setDate(queryEnd.getDate() + 1);

  const docs = await prisma.document.findMany({
    where: {
      organizationId: orgId,
      expirationDate: { gte: firstCell, lt: queryEnd },
    },
    orderBy: { expirationDate: "asc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  const byDay = new Map<string, typeof docs>();
  for (const d of docs) {
    const key = dayKey(d.expirationDate);
    const list = byDay.get(key) ?? [];
    list.push(d);
    byDay.set(key, list);
  }

  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, 1);
  const todayKey = dayKey(new Date());

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[monthIndex]} {year}
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`${basePath}?m=${monthParam(prev.year, prev.monthIndex)}`}
            className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 hover:bg-[hsl(var(--muted))]"
          >
            ← Prev
          </Link>
          <Link
            href={basePath}
            className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 hover:bg-[hsl(var(--muted))]"
          >
            Today
          </Link>
          <Link
            href={`${basePath}?m=${monthParam(next.year, next.monthIndex)}`}
            className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 hover:bg-[hsl(var(--muted))]"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-center text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthIndex;
          const key = dayKey(d);
          const docsHere = byDay.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={i}
              className={cn(
                "min-h-[96px] border-b border-r border-[hsl(var(--border))] p-1.5 align-top",
                i % 7 === 6 && "border-r-0",
                i >= 35 && "border-b-0",
                !inMonth && "bg-[hsl(var(--muted))]/40",
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  !inMonth && "text-[hsl(var(--muted-foreground))]",
                  isToday && "bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))]",
                )}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {docsHere.map((doc) => {
                  const status = expirationStatus(doc.expirationDate);
                  return (
                    <Link
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      title={`${doc.name} — ${doc.owner.name ?? doc.owner.email}`}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px] hover:underline",
                        chipStyles[status],
                      )}
                    >
                      {doc.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
