import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

const PREVIEW_LENGTH = 220;

function preview(body: string) {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed;
  return trimmed.slice(0, PREVIEW_LENGTH) + "…";
}

export default async function KbIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const where: Prisma.KbArticleWhereInput = {
    organizationId: orgId,
    published: true,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const articles = await prisma.kbArticle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Reference articles and resources published by your organization.
        </p>
      </div>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search articles…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          {query ? (
            <Link
              href="/kb"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[hsl(var(--border))] px-4 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {query ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {articles.length} result{articles.length === 1 ? "" : "s"} for{" "}
          <span className="font-medium">&ldquo;{query}&rdquo;</span>
        </p>
      ) : null}

      <div className="space-y-2">
        {articles.map((a) => (
          <Card key={a.id}>
            <Link
              href={`/kb/${a.id}`}
              className="font-medium hover:underline"
            >
              {a.title}
            </Link>
            <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {a.author.name ?? a.author.email} · Updated {formatDate(a.updatedAt)}
              {a.fileName ? (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {a.fileName}
                </span>
              ) : null}
            </div>
            {a.body ? (
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {preview(a.body)}
              </p>
            ) : null}
          </Card>
        ))}
        {articles.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {query
                ? "No articles match your search."
                : "No articles have been published yet."}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
