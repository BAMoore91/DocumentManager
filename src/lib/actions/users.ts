"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordAction } from "@/lib/audit-log";
import { getOrgSeatUsage } from "@/lib/seats";
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
  const customRoleIdRaw = (formData.get("customRoleId") as string | null) || "";

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

  let customRoleId: string | null = null;
  if (customRoleIdRaw && parsed.data.organizationId) {
    const cr = await prisma.customRole.findUnique({ where: { id: customRoleIdRaw } });
    if (!cr || cr.organizationId !== parsed.data.organizationId) {
      throw new Error("Invalid title");
    }
    customRoleId = cr.id;
  }

  if (parsed.data.organizationId) {
    const seats = await getOrgSeatUsage(parsed.data.organizationId);
    if (seats.isFull) {
      throw new Error(
        `This organization has reached its user limit (${seats.used}/${seats.limit}). ` +
          `Ask the global administrator to raise the limit, or archive an existing user first.`,
      );
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  let createdId: string | null = null;
  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        organizationId: parsed.data.organizationId,
        customRoleId,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    throw new Error("Email already in use");
  }

  if (parsed.data.organizationId && createdId) {
    await recordAction({
      organizationId: parsed.data.organizationId,
      userId: session.user.id,
      action: "user.create",
      summary: `Created ${parsed.data.role.replace("_", " ").toLowerCase()} ${parsed.data.name} (${parsed.data.email})`,
      entityType: "User",
      entityId: createdId,
    });
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/admin/users");
  revalidatePath("/super-admin");
  revalidatePath("/admin");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  if (!id) throw new Error("Missing id");
  if (id === session.user.id) throw new Error("Cannot delete yourself");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Not found");

  if (confirmEmail !== target.email.toLowerCase()) {
    throw new Error(
      "Confirmation does not match the user's email — deletion cancelled.",
    );
  }

  if (session.user.role === "ORG_ADMIN") {
    if (target.organizationId !== session.user.organizationId) throw new Error("Forbidden");
    if (target.role === "SUPER_ADMIN") throw new Error("Forbidden");
  }

  await prisma.user.delete({ where: { id } });

  if (target.organizationId) {
    await recordAction({
      organizationId: target.organizationId,
      userId: session.user.id,
      action: "user.delete",
      summary: `Permanently deleted ${target.name ?? target.email} (${target.email})`,
      entityType: "User",
      entityId: target.id,
    });
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/admin/users");
}

export async function archiveUser(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  if (id === session.user.id) throw new Error("Cannot archive yourself");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Not found");

  if (session.user.role === "ORG_ADMIN") {
    if (target.organizationId !== session.user.organizationId) throw new Error("Forbidden");
    if (target.role === "SUPER_ADMIN") throw new Error("Forbidden");
  }

  await prisma.user.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  if (target.organizationId) {
    await recordAction({
      organizationId: target.organizationId,
      userId: session.user.id,
      action: "user.archive",
      summary: `Archived ${target.name ?? target.email}`,
      entityType: "User",
      entityId: target.id,
    });
  }
  revalidatePath("/super-admin/users");
  revalidatePath("/admin/users");
}

export async function restoreUser(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Not found");

  if (session.user.role === "ORG_ADMIN") {
    if (target.organizationId !== session.user.organizationId) throw new Error("Forbidden");
    if (target.role === "SUPER_ADMIN") throw new Error("Forbidden");
  }

  if (target.organizationId) {
    const seats = await getOrgSeatUsage(target.organizationId);
    if (seats.isFull) {
      throw new Error(
        `Cannot restore — organization is at its user limit (${seats.used}/${seats.limit}).`,
      );
    }
  }

  await prisma.user.update({
    where: { id },
    data: { archivedAt: null },
  });
  if (target.organizationId) {
    await recordAction({
      organizationId: target.organizationId,
      userId: session.user.id,
      action: "user.restore",
      summary: `Restored ${target.name ?? target.email}`,
      entityType: "User",
      entityId: target.id,
    });
  }
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
  if (target.organizationId) {
    await recordAction({
      organizationId: target.organizationId,
      userId: session.user.id,
      action: "user.password_reset",
      summary: `Reset password for ${target.name ?? target.email}`,
      entityType: "User",
      entityId: target.id,
    });
  }
}
