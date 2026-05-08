"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});

export async function createCustomRole(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");

  const parsed = createSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { organizationId, name } = parsed.data;

  if (
    session.user.role === "ORG_ADMIN" &&
    session.user.organizationId !== organizationId
  ) {
    throw new Error("Forbidden");
  }

  try {
    await prisma.customRole.create({ data: { organizationId, name } });
  } catch {
    throw new Error("A role with that name already exists");
  }

  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin/settings/required-documents");
  revalidatePath("/admin/users");
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function deleteCustomRole(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const role = await prisma.customRole.findUnique({ where: { id } });
  if (!role) throw new Error("Not found");

  if (
    session.user.role === "ORG_ADMIN" &&
    session.user.organizationId !== role.organizationId
  ) {
    throw new Error("Forbidden");
  }

  await prisma.customRole.delete({ where: { id } });

  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin/settings/required-documents");
  revalidatePath("/admin/users");
  revalidatePath(`/super-admin/organizations/${role.organizationId}`);
}

export async function assignCustomRole(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const customRoleIdRaw = String(formData.get("customRoleId") ?? "");
  if (!userId) throw new Error("Missing userId");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !target.organizationId) throw new Error("User not found");

  if (
    session.user.role === "ORG_ADMIN" &&
    target.organizationId !== session.user.organizationId
  ) {
    throw new Error("Forbidden");
  }

  let customRoleId: string | null = null;
  if (customRoleIdRaw) {
    const role = await prisma.customRole.findUnique({ where: { id: customRoleIdRaw } });
    if (!role || role.organizationId !== target.organizationId) {
      throw new Error("Invalid role");
    }
    customRoleId = role.id;
  }

  await prisma.user.update({ where: { id: userId }, data: { customRoleId } });

  revalidatePath("/admin/users");
  revalidatePath("/admin/settings/roles");
}
