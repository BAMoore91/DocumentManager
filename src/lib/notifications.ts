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
