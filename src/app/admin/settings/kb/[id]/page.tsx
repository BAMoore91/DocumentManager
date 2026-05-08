import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  deleteKbArticle,
  removeKbArticleFile,
  setKbArticlePublished,
  updateKbArticle,
} from "@/lib/actions/kb";
import { formatBytes, formatDate } from "@/lib/utils";

export default async function KbEditPage({
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
  if (!article || article.organizationId !== orgId) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings/kb"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Knowledge Base
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {article.published ? "Published" : "Draft"} · By{" "}
            {article.author.name ?? article.author.email} · Updated{" "}
            {formatDate(article.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={setKbArticlePublished}>
            <input type="hidden" name="id" value={article.id} />
            <input
              type="hidden"
              name="published"
              value={article.published ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={article.published ? "secondary" : "primary"}
            >
              {article.published ? "Unpublish" : "Publish"}
            </Button>
          </form>
          <form action={deleteKbArticle}>
            <input type="hidden" name="id" value={article.id} />
            <Button type="submit" variant="danger">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Edit article</h2>
        <form
          action={updateKbArticle}
          encType="multipart/form-data"
          className="space-y-3"
        >
          <input type="hidden" name="id" value={article.id} />
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={article.title}
              required
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              name="body"
              defaultValue={article.body}
              maxLength={50000}
              className="min-h-[200px]"
            />
          </div>
          <div>
            <Label htmlFor="file">
              {article.fileUrl ? "Replace attachment" : "Attachment"} (optional, max 15 MB)
            </Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>

      {article.fileUrl ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Current attachment</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                <Link
                  href={article.fileUrl}
                  target="_blank"
                  className="text-[hsl(var(--primary))] hover:underline"
                >
                  {article.fileName ?? "Download"}
                </Link>
                {article.fileSize ? ` · ${formatBytes(article.fileSize)}` : ""}
              </div>
            </div>
            <form action={removeKbArticleFile}>
              <input type="hidden" name="id" value={article.id} />
              <Button type="submit" variant="secondary" size="sm">
                Remove file
              </Button>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
