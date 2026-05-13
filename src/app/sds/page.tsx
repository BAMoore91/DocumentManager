import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText } from "lucide-react";
import { SdsFindModal } from "@/components/sds-find-modal";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { formatBytes, formatDate } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export default async function SdsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const where: Prisma.SdsSheetWhereInput = {
    organizationId: orgId,
    ...(query
      ? {
          OR: [
            { productName: { contains: query, mode: "insensitive" } },
            { manufacturer: { contains: query, mode: "insensitive" } },
            { casNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sheets = await prisma.sdsSheet.findMany({
    where,
    orderBy: { productName: "asc" },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });

  const isAdmin = session.user.role === "ORG_ADMIN";
  const aiEnabled = isAnthropicConfigured();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Safety Data Sheets</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Search and download SDS sheets for chemicals used on the job.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {aiEnabled ? <SdsFindModal /> : null}
            <Link
              href="/sds/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
            >
              Upload SDS
            </Link>
          </div>
        ) : null}
      </div>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search by product, manufacturer, or CAS number…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          {query ? (
            <Link
              href="/sds"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[hsl(var(--border))] px-4 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {query ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {sheets.length} result{sheets.length === 1 ? "" : "s"} for{" "}
          <span className="font-medium">&ldquo;{query}&rdquo;</span>
        </p>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Manufacturer</th>
              <th className="px-4 py-3">CAS #</th>
              <th className="px-4 py-3">Revision</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/sds/${s.id}`} className="hover:underline">
                    {s.productName}
                  </Link>
                  {s.isStale ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      {s.staleReason === "newer-revision-found"
                        ? "New version available"
                        : "Stale"}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{s.manufacturer ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{s.casNumber ?? "—"}</td>
                <td className="px-4 py-3">{s.revisionDate ? formatDate(s.revisionDate) : "—"}</td>
                <td className="px-4 py-3 tabular-nums">{formatBytes(s.fileSize)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={s.fileUrl}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {sheets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  {query
                    ? "No SDS sheets match your search."
                    : "No SDS sheets uploaded yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
