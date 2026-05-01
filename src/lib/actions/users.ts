"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { Role } from "@prisma/client";

const newUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(72),
  role: z.enum(["SUPER_ADMIN", "ORG_ADMIN", "USER"]),
  organizationId: z.string().nullable(),
});

export async function createUser(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");

  const role = formData.get("role") as Role;
  let organizationId = (formData.get("organizationId") as string | null) || null;

  if (session.user.role === "ORG_ADMIN") {
    if (role === "SUPER_ADMIN") throw new Error("Forbidden role");
    organizationId = session.user.organizationId;
  }
  if (role !== "SUPER_ADMIN" && !organizationId) {
    throw new Error("Organization is required");
  }
  if (role === "SUPER_ADMIN") organizationId = null;

  const parsed = newUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role,
    organizationId,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        organizationId: parsed.data.organizationId,
      },
    });
  } catch {
    throw new Error("Email already in use");
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/admin/users");
  revalidatePath("/super-admin");
  revalidatePath("/admin");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  if (id === session.user.id) throw new Error("Cannot delete yourself");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Not found");

  if (session.user.role === "ORG_ADMIN") {
    if (target.organizationId !== session.user.organizationId) throw new Error("Forbidden");
    if (target.role === "SUPER_ADMIN") throw new Error("Forbidden");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/super-admin/users");
  revalidatePath("/admin/users");
}

export async function resetPassword(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 8) throw new Error("Password must be at least 8 characters");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Not found");
  if (session.user.role === "ORG_ADMIN") {
    if (target.organizationId !== session.user.organizationId) throw new Error("Forbidden");
    if (target.role === "SUPER_ADMIN") throw new Error("Forbidden");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
