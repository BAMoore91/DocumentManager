"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyForumReply } from "@/lib/notifications";

const topicSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

const replySchema = z.object({
  topicId: z.string().min(1),
  body: z.string().trim().min(1).max(20000),
});

export async function createTopic(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = topicSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("Title and body are required");

  const created = await prisma.forumTopic.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      organizationId: session.user.organizationId,
      authorId: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/forum");
  redirect(`/forum/${created.id}`);
}

export async function deleteTopic(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const topic = await prisma.forumTopic.findUnique({ where: { id } });
  if (!topic) throw new Error("Not found");
  if (topic.organizationId !== session.user.organizationId) throw new Error("Forbidden");
  if (session.user.role !== "ORG_ADMIN" && topic.authorId !== session.user.id) {
    throw new Error("Forbidden");
  }

  await prisma.notification.deleteMany({
    where: { sourceId: id, type: "FORUM_REPLY" },
  });
  await prisma.forumTopic.delete({ where: { id } });
  revalidatePath("/forum");
  redirect("/forum");
}

export async function setTopicPinned(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (session.user.role !== "ORG_ADMIN") throw new Error("Forbidden");
  const id = String(formData.get("id") ?? "");
  const pinned = formData.get("pinned") === "true";
  if (!id) throw new Error("Missing id");

  const topic = await prisma.forumTopic.findUnique({ where: { id } });
  if (!topic) throw new Error("Not found");
  if (topic.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  await prisma.forumTopic.update({ where: { id }, data: { pinned } });
  revalidatePath("/forum");
  revalidatePath(`/forum/${id}`);
}

export async function createReply(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = replySchema.safeParse({
    topicId: formData.get("topicId"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("Reply cannot be empty");

  const topic = await prisma.forumTopic.findUnique({
    where: { id: parsed.data.topicId },
    select: { organizationId: true, title: true },
  });
  if (!topic) throw new Error("Topic not found");
  if (topic.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  await prisma.forumReply.create({
    data: {
      topicId: parsed.data.topicId,
      authorId: session.user.id,
      body: parsed.data.body,
    },
  });

  await prisma.forumTopic.update({
    where: { id: parsed.data.topicId },
    data: { updatedAt: new Date() },
  });

  await notifyForumReply(
    parsed.data.topicId,
    topic.title,
    session.user.id,
    session.user.name ?? session.user.email ?? "Someone",
  );

  revalidatePath("/forum");
  revalidatePath(`/forum/${parsed.data.topicId}`);
}

export async function deleteReply(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const reply = await prisma.forumReply.findUnique({
    where: { id },
    include: { topic: { select: { id: true, organizationId: true } } },
  });
  if (!reply) throw new Error("Not found");
  if (reply.topic.organizationId !== session.user.organizationId) {
    throw new Error("Forbidden");
  }
  if (session.user.role !== "ORG_ADMIN" && reply.authorId !== session.user.id) {
    throw new Error("Forbidden");
  }

  await prisma.forumReply.delete({ where: { id } });
  revalidatePath(`/forum/${reply.topic.id}`);
}
