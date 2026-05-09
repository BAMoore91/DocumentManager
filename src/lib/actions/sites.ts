"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { SiteStatus } from "@prisma/client";

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

const dateOrNull = z.preprocess((v) => {
  if (!v) return null;
  return v;
}, z.string().nullable());

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  contactPhone: z.string().max(60).optional().nullable(),
  emergencyContact: z.string().max(300).optional().nullable(),
  musterPoint: z.string().max(300).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  openedAt: dateOrNull,
  closedAt: dateOrNull,
});

export async function createSite(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = createSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    code: formData.get("code") || null,
    address: formData.get("address") || null,
    contactName: formData.get("contactName") || null,
    contactPhone: formData.get("contactPhone") || null,
    emergencyContact: formData.get("emergencyContact") || null,
    musterPoint: formData.get("musterPoint") || null,
    notes: formData.get("notes") || null,
    openedAt: formData.get("openedAt") || null,
    closedAt: formData.get("closedAt") || null,
  });
  if (!parsed.success) throw new Error("Site name is required");
  await assertOrgAccess(session.user.role, session.user.organizationId, parsed.data.organizationId);

  try {
    await prisma.site.create({
      data: {
        organizationId: parsed.data.organizationId,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        address: parsed.data.address ?? null,
        contactName: parsed.data.contactName ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
        emergencyContact: parsed.data.emergencyContact ?? null,
        musterPoint: parsed.data.musterPoint ?? null,
        notes: parsed.data.notes ?? null,
        openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : null,
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      },
    });
  } catch {
    throw new Error("A site with that name already exists");
  }

  revalidatePath("/admin/settings/sites");
}

const updateSchema = createSchema.extend({ id: z.string().min(1) });

export async function updateSite(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    code: formData.get("code") || null,
    address: formData.get("address") || null,
    contactName: formData.get("contactName") || null,
    contactPhone: formData.get("contactPhone") || null,
    emergencyContact: formData.get("emergencyContact") || null,
    musterPoint: formData.get("musterPoint") || null,
    notes: formData.get("notes") || null,
    openedAt: formData.get("openedAt") || null,
    closedAt: formData.get("closedAt") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const site = await prisma.site.findUnique({ where: { id: parsed.data.id } });
  if (!site) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, site.organizationId);

  try {
    await prisma.site.update({
      where: { id: site.id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        address: parsed.data.address ?? null,
        contactName: parsed.data.contactName ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
        emergencyContact: parsed.data.emergencyContact ?? null,
        musterPoint: parsed.data.musterPoint ?? null,
        notes: parsed.data.notes ?? null,
        openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : null,
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      },
    });
  } catch {
    throw new Error("A site with that name already exists");
  }

  revalidatePath("/admin/settings/sites");
  revalidatePath(`/admin/settings/sites/${site.id}`);
}

export async function setSiteStatus(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as SiteStatus;
  if (!id || (status !== "ACTIVE" && status !== "ARCHIVED")) throw new Error("Invalid input");

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, site.organizationId);

  await prisma.site.update({ where: { id }, data: { status } });
  revalidatePath("/admin/settings/sites");
  revalidatePath(`/admin/settings/sites/${id}`);
}

export async function deleteSite(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, site.organizationId);

  await prisma.site.delete({ where: { id } });
  revalidatePath("/admin/settings/sites");
}
