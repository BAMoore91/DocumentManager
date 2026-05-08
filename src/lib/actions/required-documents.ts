"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) {
    throw new Error("Forbidden");
  }
}

async function validateOrgRoles(orgId: string, customRoleIds: string[]) {
  if (customRoleIds.length === 0) return [];
  const found = await prisma.customRole.findMany({
    where: { id: { in: customRoleIds }, organizationId: orgId },
    select: { id: true },
  });
  if (found.length !== customRoleIds.length) {
    throw new Error("One or more roles do not belong to this organization");
  }
  return found.map((r) => r.id);
}

export async function createRequiredDocument(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = createSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { organizationId, name } = parsed.data;

  await assertOrgAccess(session.user.role, session.user.organizationId, organizationId);

  const customRoleIds = formData
    .getAll("customRoleIds")
    .map((v) => String(v))
    .filter(Boolean);
  const validIds = await validateOrgRoles(organizationId, customRoleIds);

  try {
    await prisma.requiredDocument.create({
      data: {
        organizationId,
        name,
        customRoles: { connect: validIds.map((id) => ({ id })) },
      },
    });
  } catch {
    throw new Error("A required document with that name already exists");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function deleteRequiredDocument(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const req = await prisma.requiredDocument.findUnique({ where: { id } });
  if (!req) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, req.organizationId);

  await prisma.requiredDocument.delete({ where: { id } });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/super-admin/organizations/${req.organizationId}`);
}

export async function setRequiredDocumentRoles(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const req = await prisma.requiredDocument.findUnique({ where: { id } });
  if (!req) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, req.organizationId);

  const customRoleIds = formData
    .getAll("customRoleIds")
    .map((v) => String(v))
    .filter(Boolean);
  const validIds = await validateOrgRoles(req.organizationId, customRoleIds);

  await prisma.requiredDocument.update({
    where: { id },
    data: {
      customRoles: { set: validIds.map((rid) => ({ id: rid })) },
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/super-admin/organizations/${req.organizationId}`);
}
