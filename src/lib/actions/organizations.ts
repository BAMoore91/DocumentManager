"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const orgSchema = z.object({
  name: z.string().min(2).max(100),
});

export async function createOrganization(formData: FormData) {
  await requireRole("SUPER_ADMIN");
  const parsed = orgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Invalid organization name" };

  try {
    await prisma.organization.create({ data: { name: parsed.data.name } });
  } catch {
    return { error: "Organization name already exists" };
  }
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
  return { success: true };
}

export async function deleteOrganization(formData: FormData) {
  await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  await prisma.organization.delete({ where: { id } });
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
  return { success: true };
}

export async function renameOrganization(formData: FormData) {
  await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!id || name.length < 2) return { error: "Invalid input" };
  try {
    await prisma.organization.update({ where: { id }, data: { name } });
  } catch {
    return { error: "Name conflict" };
  }
  revalidatePath("/super-admin/organizations");
  return { success: true };
}
