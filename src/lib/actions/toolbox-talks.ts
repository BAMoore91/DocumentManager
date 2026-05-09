"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { expectedAttendeeIds, notifyToolboxTalkAssigned } from "@/lib/notifications";

const createSchema = z.object({
  organizationId: z.string().min(1),
  topic: z.string().trim().min(1).max(200),
  date: z.string().min(1),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  presenterId: z.string().min(1),
  siteId: z.string().optional().nullable(),
});

async function resolveTalkSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) {
    throw new Error("Forbidden");
  }
}

async function validateAssignmentIds(
  organizationId: string,
  roleIds: string[],
  userIds: string[],
) {
  if (roleIds.length > 0) {
    const found = await prisma.customRole.count({
      where: { id: { in: roleIds }, organizationId },
    });
    if (found !== roleIds.length) {
      throw new Error("One or more roles do not belong to this organization");
    }
  }
  if (userIds.length > 0) {
    const found = await prisma.user.count({
      where: { id: { in: userIds }, organizationId },
    });
    if (found !== userIds.length) {
      throw new Error("One or more users do not belong to this organization");
    }
  }
}

export async function createToolboxTalk(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");

  const parsed = createSchema.safeParse({
    organizationId: formData.get("organizationId"),
    topic: formData.get("topic"),
    date: formData.get("date"),
    location: formData.get("location") || null,
    notes: formData.get("notes") || null,
    presenterId: formData.get("presenterId"),
    siteId: formData.get("siteId") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { organizationId, topic, date, location, notes, presenterId } = parsed.data;

  await assertOrgAccess(session.user.role, session.user.organizationId, organizationId);

  const presenter = await prisma.user.findUnique({ where: { id: presenterId } });
  if (!presenter || presenter.organizationId !== organizationId) {
    throw new Error("Invalid presenter");
  }

  const siteId = await resolveTalkSiteId(organizationId, parsed.data.siteId);

  const assignedRoleIds = formData
    .getAll("assignedRoleIds")
    .map((v) => String(v))
    .filter(Boolean);
  const assignedUserIds = formData
    .getAll("assignedUserIds")
    .map((v) => String(v))
    .filter(Boolean);
  await validateAssignmentIds(organizationId, assignedRoleIds, assignedUserIds);

  const created = await prisma.toolboxTalk.create({
    data: {
      organizationId,
      topic,
      date: new Date(date),
      location: location ?? null,
      notes: notes ?? null,
      presenterId,
      createdById: session.user.id,
      siteId,
      assignedRoles: { connect: assignedRoleIds.map((id) => ({ id })) },
      assignedUsers: { connect: assignedUserIds.map((id) => ({ id })) },
    },
    select: { id: true, topic: true, date: true },
  });

  const expectedIds = await expectedAttendeeIds(
    organizationId,
    assignedRoleIds,
    assignedUserIds,
  );
  await notifyToolboxTalkAssigned(expectedIds, created);

  revalidatePath("/admin/toolbox-talks");
  revalidatePath("/admin/calendar");
  revalidatePath(`/super-admin/organizations/${organizationId}/calendar`);
}

export async function setToolboxTalkAssignments(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const existing = await prisma.toolboxTalk.findUnique({
    where: { id },
    include: {
      assignedRoles: { select: { id: true } },
      assignedUsers: { select: { id: true } },
    },
  });
  if (!existing) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, existing.organizationId);

  const assignedRoleIds = formData
    .getAll("assignedRoleIds")
    .map((v) => String(v))
    .filter(Boolean);
  const assignedUserIds = formData
    .getAll("assignedUserIds")
    .map((v) => String(v))
    .filter(Boolean);
  await validateAssignmentIds(existing.organizationId, assignedRoleIds, assignedUserIds);

  const oldExpectedIds = new Set(
    await expectedAttendeeIds(
      existing.organizationId,
      existing.assignedRoles.map((r) => r.id),
      existing.assignedUsers.map((u) => u.id),
    ),
  );

  const updated = await prisma.toolboxTalk.update({
    where: { id: existing.id },
    data: {
      assignedRoles: { set: assignedRoleIds.map((rid) => ({ id: rid })) },
      assignedUsers: { set: assignedUserIds.map((uid) => ({ id: uid })) },
    },
    select: { id: true, topic: true, date: true },
  });

  const newExpectedIds = await expectedAttendeeIds(
    existing.organizationId,
    assignedRoleIds,
    assignedUserIds,
  );
  const toNotify = newExpectedIds.filter((uid) => !oldExpectedIds.has(uid));
  await notifyToolboxTalkAssigned(toNotify, updated);

  revalidatePath(`/admin/toolbox-talks/${existing.id}`);
}

export async function deleteToolboxTalk(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const talk = await prisma.toolboxTalk.findUnique({ where: { id } });
  if (!talk) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, talk.organizationId);

  await prisma.notification.deleteMany({
    where: { sourceId: talk.id, type: "TOOLBOX_TALK_ASSIGNED" },
  });
  await prisma.toolboxTalk.delete({ where: { id } });

  revalidatePath("/admin/toolbox-talks");
  revalidatePath("/admin/calendar");
  revalidatePath(`/super-admin/organizations/${talk.organizationId}/calendar`);
}

export async function addAttendee(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const talkId = String(formData.get("talkId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!talkId || !userId) throw new Error("Missing input");

  const [talk, user] = await Promise.all([
    prisma.toolboxTalk.findUnique({ where: { id: talkId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!talk) throw new Error("Talk not found");
  if (!user || user.organizationId !== talk.organizationId) {
    throw new Error("Invalid attendee");
  }
  await assertOrgAccess(session.user.role, session.user.organizationId, talk.organizationId);

  await prisma.toolboxTalkAttendance.upsert({
    where: { talkId_userId: { talkId, userId } },
    update: {},
    create: { talkId, userId },
  });

  revalidatePath(`/admin/toolbox-talks/${talkId}`);
}

export async function removeAttendee(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const att = await prisma.toolboxTalkAttendance.findUnique({
    where: { id },
    include: { talk: { select: { organizationId: true, id: true } } },
  });
  if (!att) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, att.talk.organizationId);

  await prisma.toolboxTalkAttendance.delete({ where: { id } });

  revalidatePath(`/admin/toolbox-talks/${att.talk.id}`);
}
