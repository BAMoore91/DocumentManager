import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
// Note: keep this in sync with schema additions in prisma/schema.prisma.

function formatDateLocal(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function emailUsers(userIds: string[], subject: string, text: string) {
  if (userIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true },
  });
  const recipients = users.map((u) => u.email).filter(Boolean) as string[];
  if (recipients.length === 0) return;
  await sendEmail({ to: recipients, subject, text });
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
  await emailUsers(
    userIds,
    `Toolbox talk assigned: ${talk.topic}`,
    `You're assigned to the toolbox talk "${talk.topic}" on ${formatDateLocal(talk.date)}.`,
  );
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

  const recipientIds = Array.from(recipients);
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      type: "FORUM_REPLY" as const,
      title: `New reply on "${topicTitle}"`,
      body: `${replyAuthorName} replied`,
      linkUrl: `/forum/${topicId}`,
      sourceId: topicId,
    })),
  });
  await emailUsers(
    recipientIds,
    `New reply on "${topicTitle}"`,
    `${replyAuthorName} just replied on "${topicTitle}".`,
  );
}

export async function notifyCapaAssigned(
  userId: string,
  capa: { id: string; title: string; dueDate: Date | null },
) {
  await prisma.notification.create({
    data: {
      userId,
      type: "CAPA_ASSIGNED" as const,
      title: `Corrective action assigned: ${capa.title}`,
      body: capa.dueDate
        ? `Due ${formatDateLocal(capa.dueDate)}`
        : "No due date set",
      linkUrl: `/corrective-actions/${capa.id}`,
      sourceId: capa.id,
    },
  });
  await emailUsers(
    [userId],
    `Corrective action assigned: ${capa.title}`,
    capa.dueDate
      ? `You have been assigned a corrective action due ${formatDateLocal(capa.dueDate)}.`
      : "You have been assigned a corrective action.",
  );
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
