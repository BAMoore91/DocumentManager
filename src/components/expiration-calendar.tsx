import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, expirationStatus, formatDate } from "@/lib/utils";
import type { ExpirationStatus } from "@/lib/utils";
import { createEvent, deleteEvent } from "@/lib/actions/events";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const docChipStyles: Record<ExpirationStatus, string> = {
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  "expiring-30": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  "expiring-60": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "expiring-90": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  valid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const eventChipStyle =
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";

export type CalendarView = "all" | "documents" | "events";

function parseView(v: string | undefined): CalendarView {
  return v === "documents" || v === "events" ? v : "all";
}

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

function buildHref(basePath: string, m: string, view: CalendarView) {
  const params = new URLSearchParams();
  params.set("m", m);
  if (view !== "all") params.set("view", view);
  return `${basePath}?${params.toString()}`;
}

export async function ExpirationCalendar({
  orgId,
  monthParam: m,
  view: viewParam,
  basePath,
  canManageEvents = false,
}: {
  orgId: string;
  monthParam?: string;
  view?: string;
  basePath: string;
  canManageEvents?: boolean;
}) {
  const view = parseView(viewParam);
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

  const monthEndExclusive = new Date(year, monthIndex + 1, 1);

  const showDocs = view === "all" || view === "documents";
  const showEvents = view === "all" || view === "events";

  const [docs, gridEvents, monthEvents] = await Promise.all([
    showDocs
      ? prisma.document.findMany({
          where: {
            organizationId: orgId,
            expirationDate: { gte: firstCell, lt: queryEnd },
          },
          orderBy: { expirationDate: "asc" },
          include: { owner: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
    showEvents
      ? prisma.calendarEvent.findMany({
          where: {
            organizationId: orgId,
            date: { gte: firstCell, lt: queryEnd },
          },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
    canManageEvents
      ? prisma.calendarEvent.findMany({
          where: {
            organizationId: orgId,
            date: { gte: monthStart, lt: monthEndExclusive },
          },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const docsByDay = new Map<string, typeof docs>();
  for (const d of docs) {
    const key = dayKey(d.expirationDate);
    const list = docsByDay.get(key) ?? [];
    list.push(d);
    docsByDay.set(key, list);
  }

  const eventsByDay = new Map<string, typeof gridEvents>();
  for (const e of gridEvents) {
    const key = dayKey(e.date);
    const list = eventsByDay.get(key) ?? [];
    list.push(e);
    eventsByDay.set(key, list);
  }

  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, 1);
  const todayKey = dayKey(new Date());
  const currentMonthParam = monthParam(year, monthIndex);

  const filterPills: { v: CalendarView; label: string }[] = [
    { v: "all", label: "All" },
    { v: "documents", label: "Documents" },
    { v: "events", label: "Events" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              {MONTH_NAMES[monthIndex]} {year}
            </h2>
            <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5 text-xs">
              {filterPills.map(({ v, label }) => (
                <Link
                  key={v}
                  href={buildHref(basePath, currentMonthParam, v)}
                  className={cn(
                    "rounded px-2 py-1",
                    view === v
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={buildHref(basePath, monthParam(prev.year, prev.monthIndex), view)}
              className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 hover:bg-[hsl(var(--muted))]"
            >
              ← Prev
            </Link>
            <Link
              href={view === "all" ? basePath : `${basePath}?view=${view}`}
              className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 hover:bg-[hsl(var(--muted))]"
            >
              Today
            </Link>
            <Link
              href={buildHref(basePath, monthParam(next.year, next.monthIndex), view)}
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
            const dayDocs = docsByDay.get(key) ?? [];
            const dayEvents = eventsByDay.get(key) ?? [];
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
                    isToday &&
                      "bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))]",
                  )}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {dayDocs.map((doc) => {
                    const status = expirationStatus(doc.expirationDate);
                    return (
                      <Link
                        key={doc.id}
                        href={doc.fileUrl}
                        target="_blank"
                        title={`${doc.name} — ${doc.owner.name ?? doc.owner.email}`}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11px] hover:underline",
                          docChipStyles[status],
                        )}
                      >
                        {doc.name}
                      </Link>
                    );
                  })}
                  {dayEvents.map((e) => (
                    <span
                      key={e.id}
                      title={e.description ?? e.title}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px]",
                        eventChipStyle,
                      )}
                    >
                      ★ {e.title}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {canManageEvents ? (
        <Card>
          <h2 className="mb-3 font-medium">Add event</h2>
          <form
            action={createEvent}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label>Title</Label>
              <Input name="title" required maxLength={200} placeholder="OSHA inspection" />
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div className="md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea name="description" maxLength={2000} placeholder="Notes about the event" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Add event</Button>
            </div>
          </form>

          {monthEvents.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                Events in {MONTH_NAMES[monthIndex]} {year}
              </h3>
              <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
                {monthEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatDate(e.date)}
                        {e.description ? ` — ${e.description}` : ""}
                      </div>
                    </div>
                    <form action={deleteEvent}>
                      <input type="hidden" name="id" value={e.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
