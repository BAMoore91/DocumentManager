"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const createSchema = z.object({
  organizationId: z.string().min(1),
  topic: z.string().trim().min(1).max(200),
  date: z.string().min(1),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  presenterId: z.string().min(1),
});

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) {
    throw new Error("Forbidden");
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
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { organizationId, topic, date, location, notes, presenterId } = parsed.data;

  await assertOrgAccess(session.user.role, session.user.organizationId, organizationId);

  const presenter = await prisma.user.findUnique({ where: { id: presenterId } });
  if (!presenter || presenter.organizationId !== organizationId) {
    throw new Error("Invalid presenter");
  }

  await prisma.toolboxTalk.create({
    data: {
      organizationId,
      topic,
      date: new Date(date),
      location: location ?? null,
      notes: notes ?? null,
      presenterId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/toolbox-talks");
  revalidatePath("/admin/calendar");
  revalidatePath(`/super-admin/organizations/${organizationId}/calendar`);
}

export async function deleteToolboxTalk(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const talk = await prisma.toolboxTalk.findUnique({ where: { id } });
  if (!talk) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, talk.organizationId);

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
