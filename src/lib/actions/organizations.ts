"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const orgSchema = z.object({
  name: z.string().min(2).max(100),
});

export async function createOrganization(formData: FormData): Promise<void> {
  await requireRole("SUPER_ADMIN");
  const parsed = orgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Invalid organization name");

  try {
    await prisma.organization.create({ data: { name: parsed.data.name } });
  } catch {
    throw new Error("Organization name already exists");
  }
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
}

export async function deleteOrganization(formData: FormData): Promise<void> {
  await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await prisma.organization.delete({ where: { id } });
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
}

export async function renameOrganization(formData: FormData): Promise<void> {
  await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!id || name.length < 2) throw new Error("Invalid input");
  try {
    await prisma.organization.update({ where: { id }, data: { name } });
  } catch {
    throw new Error("Name conflict");
  }
  revalidatePath("/super-admin/organizations");
}
