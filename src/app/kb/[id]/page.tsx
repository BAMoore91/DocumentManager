import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Paperclip } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";

export default async function KbArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: { author: { select: { name: true, email: true } } },
  });
  if (!article || article.organizationId !== orgId || !article.published) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/kb"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Knowledge Base
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {article.author.name ?? article.author.email} · Updated{" "}
          {formatDate(article.updatedAt)}
        </p>
      </div>

      {article.fileUrl ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <Link
                href={article.fileUrl}
                target="_blank"
                className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
              >
                {article.fileName ?? "Download attachment"}
              </Link>
              {article.fileSize ? (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatBytes(article.fileSize)}
                </span>
              ) : null}
            </div>
            <Link
              href={article.fileUrl}
              target="_blank"
              className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Open
            </Link>
          </div>
        </Card>
      ) : null}

      {article.body ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{article.body}</p>
        </Card>
      ) : null}
    </div>
  );
}
