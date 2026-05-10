"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const orgSchema = z.object({
  name: z.string().min(2).max(100),
  userLimit: z.number().int().min(1).max(100000).nullable(),
});

function parseUserLimit(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function createOrganization(formData: FormData): Promise<void> {
  await requireRole("SUPER_ADMIN");
  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    userLimit: parseUserLimit(formData.get("userLimit")),
  });
  if (!parsed.success) throw new Error("Invalid organization input");

  try {
    await prisma.organization.create({
      data: { name: parsed.data.name, userLimit: parsed.data.userLimit },
    });
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

export async function setOrganizationUserLimit(formData: FormData): Promise<void> {
  await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const userLimit = parseUserLimit(formData.get("userLimit"));
  if (userLimit !== null && (userLimit < 1 || userLimit > 100000)) {
    throw new Error("User limit must be between 1 and 100,000 (or blank for unlimited)");
  }
  await prisma.organization.update({ where: { id }, data: { userLimit } });
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/organizations/${id}`);
}

