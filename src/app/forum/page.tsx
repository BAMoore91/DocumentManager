import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTopic } from "@/lib/actions/forum";
import { formatDate } from "@/lib/utils";
import { Pin } from "lucide-react";

export default async function ForumIndexPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const topics = await prisma.forumTopic.findMany({
    where: { organizationId: orgId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: {
      author: { select: { name: true, email: true } },
      _count: { select: { replies: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Safety Forum</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Open discussion for your organization. Share questions, near-misses,
          improvement ideas, or anything safety-related.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Start a new topic</h2>
        <form action={createTopic} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} placeholder="Subject" />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              name="body"
              required
              maxLength={20000}
              placeholder="Share what's on your mind…"
              className="min-h-[120px]"
            />
          </div>
          <Button type="submit">Post topic</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {topics.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {t.pinned ? (
                  <Pin
                    className="h-4 w-4 text-[hsl(var(--primary))]"
                    aria-label="Pinned"
                  />
                ) : null}
                <Link
                  href={`/forum/${t.id}`}
                  className="font-medium hover:underline"
                >
                  {t.title}
                </Link>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {t.author.name ?? t.author.email} · {formatDate(t.createdAt)}
                {" · "}
                {t._count.replies} repl{t._count.replies === 1 ? "y" : "ies"}
                {" · last activity "}
                {formatDate(t.updatedAt)}
              </div>
            </div>
            <Link
              href={`/forum/${t.id}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
            >
              Open
            </Link>
          </Card>
        ))}
        {topics.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No topics yet — be the first to post.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
