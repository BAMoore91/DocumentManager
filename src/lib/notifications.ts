import { prisma } from "@/lib/db";

function formatDateLocal(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export async function notifyToolboxTalkAssigned(
  userIds: string[],
  talk: { id: string; topic: string; date: Date },
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "TOOLBOX_TALK_ASSIGNED" as const,
      title: `Toolbox talk assigned: ${talk.topic}`,
      body: `Scheduled for ${formatDateLocal(talk.date)}`,
      linkUrl: `/toolbox-talks/${talk.id}`,
      sourceId: talk.id,
    })),
  });
}

export async function notifyForumReply(
  topicId: string,
  topicTitle: string,
  replyAuthorId: string,
  replyAuthorName: string,
) {
  const [topic, prevReplies] = await Promise.all([
    prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { authorId: true },
    }),
    prisma.forumReply.findMany({
      where: { topicId, authorId: { not: replyAuthorId } },
      select: { authorId: true },
      distinct: ["authorId"],
    }),
  ]);
  if (!topic) return;

  const recipients = new Set<string>();
  if (topic.authorId !== replyAuthorId) recipients.add(topic.authorId);
  for (const r of prevReplies) recipients.add(r.authorId);
  if (recipients.size === 0) return;

  await prisma.notification.createMany({
    data: Array.from(recipients).map((userId) => ({
      userId,
      type: "FORUM_REPLY" as const,
      title: `New reply on "${topicTitle}"`,
      body: `${replyAuthorName} replied`,
      linkUrl: `/forum/${topicId}`,
      sourceId: topicId,
    })),
  });
}

export async function expectedAttendeeIds(
  organizationId: string,
  roleIds: string[],
  userIds: string[],
): Promise<string[]> {
  const ids = new Set<string>(userIds);
  if (roleIds.length > 0) {
    const usersInRoles = await prisma.user.findMany({
      where: { organizationId, customRoleId: { in: roleIds } },
      select: { id: true },
    });
    for (const u of usersInRoles) ids.add(u.id);
  }
  return Array.from(ids);
}
