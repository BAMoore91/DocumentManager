"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import type { EquipmentStatus, InspectionResult } from "@prisma/client";

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function resolveSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

const equipmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().max(60).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  manufacturer: z.string().max(120).optional().nullable(),
  siteId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createEquipment(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || null,
    serialNumber: formData.get("serialNumber") || null,
    manufacturer: formData.get("manufacturer") || null,
    siteId: formData.get("siteId") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Equipment name is required");
  const siteId = await resolveSiteId(session.user.organizationId, parsed.data.siteId);

  await prisma.equipment.create({
    data: {
      organizationId: session.user.organizationId,
      name: parsed.data.name,
      type: parsed.data.type ?? null,
      serialNumber: parsed.data.serialNumber ?? null,
      manufacturer: parsed.data.manufacturer ?? null,
      notes: parsed.data.notes ?? null,
      siteId,
    },
  });
  revalidatePath("/equipment");
}

export async function updateEquipment(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const equip = await prisma.equipment.findUnique({ where: { id } });
  if (!equip) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, equip.organizationId);

  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || null,
    serialNumber: formData.get("serialNumber") || null,
    manufacturer: formData.get("manufacturer") || null,
    siteId: formData.get("siteId") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");
  const siteId = await resolveSiteId(equip.organizationId, parsed.data.siteId);

  await prisma.equipment.update({
    where: { id: equip.id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type ?? null,
      serialNumber: parsed.data.serialNumber ?? null,
      manufacturer: parsed.data.manufacturer ?? null,
      notes: parsed.data.notes ?? null,
      siteId,
    },
  });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equip.id}`);
}

export async function setEquipmentStatus(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as EquipmentStatus;
  if (!id || !["ACTIVE", "OUT_OF_SERVICE", "RETIRED"].includes(status)) {
    throw new Error("Invalid input");
  }

  const equip = await prisma.equipment.findUnique({ where: { id } });
  if (!equip) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, equip.organizationId);

  await prisma.equipment.update({ where: { id }, data: { status } });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${id}`);
}

export async function deleteEquipment(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const equip = await prisma.equipment.findUnique({ where: { id } });
  if (!equip) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, equip.organizationId);

  await prisma.equipment.delete({ where: { id } });
  revalidatePath("/equipment");
  redirect("/equipment");
}

const inspectionSchema = z.object({
  equipmentId: z.string().min(1),
  performedAt: z.string().min(1),
  result: z.enum(["PASS", "FAIL_NEEDS_REPAIR", "FAIL_OUT_OF_SERVICE"]),
  defects: z.string().max(5000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function logInspection(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = inspectionSchema.safeParse({
    equipmentId: formData.get("equipmentId"),
    performedAt: formData.get("performedAt"),
    result: formData.get("result"),
    defects: formData.get("defects") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Equipment, date, and result are required");

  const equip = await prisma.equipment.findUnique({ where: { id: parsed.data.equipmentId } });
  if (!equip || equip.organizationId !== session.user.organizationId) {
    throw new Error("Invalid equipment");
  }

  const oos = parsed.data.result === "FAIL_OUT_OF_SERVICE";

  await prisma.equipmentInspection.create({
    data: {
      equipmentId: equip.id,
      performedById: session.user.id,
      performedAt: new Date(parsed.data.performedAt),
      result: parsed.data.result as InspectionResult,
      defects: parsed.data.defects ?? null,
      notes: parsed.data.notes ?? null,
      outOfService: oos,
    },
  });

  if (oos) {
    await prisma.equipment.update({
      where: { id: equip.id },
      data: { status: "OUT_OF_SERVICE" },
    });
  }

  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equip.id}`);
}

export async function deleteInspection(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const insp = await prisma.equipmentInspection.findUnique({
    where: { id },
    include: { equipment: true },
  });
  if (!insp) throw new Error("Not found");
  if (insp.equipment.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  await prisma.equipmentInspection.delete({ where: { id } });
  revalidatePath(`/equipment/${insp.equipment.id}`);
}
