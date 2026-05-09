import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { SubmitButton } from "@/components/submit-button";
import {
  createKbArticle,
  deleteKbArticle,
  setKbArticlePublished,
} from "@/lib/actions/kb";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export default async function KbSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const articles = await prisma.kbArticle.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Publish reference articles for your members — policies, SOPs, training
            materials. Save as draft, then publish to make it visible on the
            Knowledge Base menu.
          </p>
        </div>
        <FormModal triggerLabel="New article" title="New article" size="lg">
          <form
            action={createKbArticle}
            encType="multipart/form-data"
            className="space-y-3"
          >
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                name="title"
                required
                maxLength={200}
                placeholder="Lockout / Tagout procedure"
              />
            </div>
            <div>
              <Label htmlFor="kb-body">Body</Label>
              <Textarea
                id="kb-body"
                name="body"
                maxLength={50000}
                placeholder="Write the article here. Plain text — line breaks are preserved."
                className="min-h-[160px]"
              />
            </div>
            <div>
              <Label htmlFor="kb-file">Attachment (optional, max 15 MB)</Label>
              <Input
                id="kb-file"
                name="file"
                type="file"
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              />
            </div>
            <SubmitButton pendingLabel="Uploading…">Create article</SubmitButton>
          </form>
        </FormModal>
      </div>

      <div className="space-y-2">
        {articles.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/settings/kb/${a.id}`}
                  className="font-medium hover:underline"
                >
                  {a.title}
                </Link>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    a.published
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {a.published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {a.author.name ?? a.author.email} · Updated {formatDate(a.updatedAt)}
                {a.fileName ? (
                  <>
                    {" · "}
                    {a.fileName}
                    {a.fileSize ? ` (${formatBytes(a.fileSize)})` : ""}
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <form action={setKbArticlePublished}>
                <input type="hidden" name="id" value={a.id} />
                <input
                  type="hidden"
                  name="published"
                  value={a.published ? "false" : "true"}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {a.published ? "Unpublish" : "Publish"}
                </Button>
              </form>
              <Link
                href={`/admin/settings/kb/${a.id}`}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Edit
              </Link>
              <form action={deleteKbArticle}>
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ))}
        {articles.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No articles yet — create one above.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
