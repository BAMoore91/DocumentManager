import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createReply,
  deleteReply,
  deleteTopic,
  setTopicPinned,
} from "@/lib/actions/forum";
import { formatDate } from "@/lib/utils";
import { Pin } from "lucide-react";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const topic = await prisma.forumTopic.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!topic || topic.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";
  const canEditTopic = isAdmin || topic.author.id === session.user.id;

  return (
    <div className="space-y-6">
      <Link
        href="/forum"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← All topics
      </Link>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {topic.pinned ? (
                <Pin
                  className="h-5 w-5 text-[hsl(var(--primary))]"
                  aria-label="Pinned"
                />
              ) : null}
              {topic.title}
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Posted by {topic.author.name ?? topic.author.email} ·{" "}
              {formatDate(topic.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <form action={setTopicPinned}>
                <input type="hidden" name="id" value={topic.id} />
                <input type="hidden" name="pinned" value={topic.pinned ? "false" : "true"} />
                <Button type="submit" size="sm" variant="secondary">
                  {topic.pinned ? "Unpin" : "Pin"}
                </Button>
              </form>
            ) : null}
            {canEditTopic ? (
              <form action={deleteTopic}>
                <input type="hidden" name="id" value={topic.id} />
                <Button type="submit" size="sm" variant="danger">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm">{topic.body}</p>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          {topic.replies.length} repl
          {topic.replies.length === 1 ? "y" : "ies"}
        </h2>
        {topic.replies.map((r) => {
          const canDelete = isAdmin || r.author.id === session.user.id;
          return (
            <Card key={r.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{r.author.name ?? r.author.email}</span>
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                {canDelete ? (
                  <form action={deleteReply}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="sm" variant="danger">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.body}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <form action={createReply} className="space-y-3">
          <input type="hidden" name="topicId" value={topic.id} />
          <div>
            <Label htmlFor="reply-body">Reply</Label>
            <Textarea
              id="reply-body"
              name="body"
              required
              maxLength={20000}
              placeholder="Add to the discussion…"
              className="min-h-[100px]"
            />
          </div>
          <Button type="submit">Post reply</Button>
        </form>
      </Card>
    </div>
  );
}
