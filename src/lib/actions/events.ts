"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const eventSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  date: z.string().min(1),
});

export async function createEvent(formData: FormData): Promise<void> {
  const session = await requireAuth();

  const parsed = eventSchema.safeParse({
    organizationId: formData.get("organizationId"),
    title: formData.get("title"),
    description: formData.get("description") ?? null,
    date: formData.get("date"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { organizationId, title, description, date } = parsed.data;

  if (session.user.role === "USER") throw new Error("Forbidden");
  if (
    session.user.role === "ORG_ADMIN" &&
    session.user.organizationId !== organizationId
  ) {
    throw new Error("Forbidden");
  }

  await prisma.calendarEvent.create({
    data: {
      organizationId,
      title,
      description: description ?? null,
      date: new Date(date),
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/calendar");
  revalidatePath(`/super-admin/organizations/${organizationId}/calendar`);
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event) throw new Error("Not found");

  if (session.user.role === "USER") throw new Error("Forbidden");
  if (
    session.user.role === "ORG_ADMIN" &&
    session.user.organizationId !== event.organizationId
  ) {
    throw new Error("Forbidden");
  }

  await prisma.calendarEvent.delete({ where: { id } });

  revalidatePath("/admin/calendar");
  revalidatePath(`/super-admin/organizations/${event.organizationId}/calendar`);
}
