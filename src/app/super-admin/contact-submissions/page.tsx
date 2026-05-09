import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { deleteContactSubmission } from "@/lib/actions/contact";
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

export default async function SuperAdminContactSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.ContactSubmissionWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { industry: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [submissions, total] = await Promise.all([
    prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.contactSubmission.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `/super-admin/contact-submissions?${s}` : "/super-admin/contact-submissions";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Website contact submissions</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Requests submitted from the public landing page contact form.
        </p>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Name, business, email, industry…"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Link
              href="/super-admin/contact-submissions"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[hsl(var(--border))] px-4 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="text-sm text-[hsl(var(--muted-foreground))]">
        {total.toLocaleString()} submission{total === 1 ? "" : "s"}
      </div>

      <div className="space-y-3">
        {submissions.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{s.businessName}</span>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {s.industry} · {s.userCount} user{s.userCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1 text-sm">
                  {s.name} ·{" "}
                  <a
                    href={`mailto:${s.email}`}
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    {s.email}
                  </a>{" "}
                  ·{" "}
                  <a
                    href={`tel:${s.phone}`}
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    {s.phone}
                  </a>
                </div>
                <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {s.address}
                </div>
                <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Submitted {formatDateTime(s.createdAt)}
                </div>
                {s.message ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-[hsl(var(--muted))] p-3 text-sm">
                    {s.message}
                  </p>
                ) : null}
              </div>
              <form action={deleteContactSubmission}>
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                  Delete
                </SubmitButton>
              </form>
            </div>
          </Card>
        ))}
        {submissions.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {q ? "No submissions match this search." : "No submissions yet."}
            </p>
          </Card>
        ) : null}
      </div>

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
