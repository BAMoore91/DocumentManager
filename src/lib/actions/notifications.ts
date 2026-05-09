"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const result = await prisma.notification.updateMany({
    where: { id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw new Error("Not found");

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}
