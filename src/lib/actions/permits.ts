"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireAuth } from "@/lib/auth";
import type { PermitStatus, PermitType } from "@prisma/client";

const TYPES = [
  "HOT_WORK",
  "CONFINED_SPACE",
  "LOCKOUT_TAGOUT",
  "WORKING_AT_HEIGHTS",
  "ELECTRICAL",
  "EXCAVATION",
  "OTHER",
] as const;

const STATUSES = ["DRAFT", "ISSUED", "EXPIRED", "CLOSED"] as const;

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function resolveSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

async function resolveRecipient(organizationId: string, recipientIdRaw: string | null | undefined) {
  if (!recipientIdRaw) return null;
  const user = await prisma.user.findUnique({ where: { id: recipientIdRaw } });
  if (!user || user.organizationId !== organizationId) throw new Error("Invalid recipient");
  return user.id;
}

const permitSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  hazards: z.string().max(5000).optional().nullable(),
  controls: z.string().max(5000).optional().nullable(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  recipientId: z.string().optional().nullable(),
  recipientName: z.string().max(200).optional().nullable(),
  siteId: z.string().optional().nullable(),
});

export async function createPermit(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const parsed = permitSchema.safeParse({
    type: formData.get("type") || "OTHER",
    title: formData.get("title"),
    location: formData.get("location") || null,
    description: formData.get("description") || null,
    hazards: formData.get("hazards") || null,
    controls: formData.get("controls") || null,
    validFrom: formData.get("validFrom"),
    validUntil: formData.get("validUntil"),
    recipientId: formData.get("recipientId") || null,
    recipientName: formData.get("recipientName") || null,
    siteId: formData.get("siteId") || null,
  });
  if (!parsed.success) throw new Error("Type, title, valid-from and valid-until are required");

  const siteId = await resolveSiteId(session.user.organizationId, parsed.data.siteId);
  const recipientId = await resolveRecipient(session.user.organizationId, parsed.data.recipientId);

  const created = await prisma.permit.create({
    data: {
      organizationId: session.user.organizationId,
      type: parsed.data.type as PermitType,
      title: parsed.data.title,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      hazards: parsed.data.hazards ?? null,
      controls: parsed.data.controls ?? null,
      validFrom: new Date(parsed.data.validFrom),
      validUntil: new Date(parsed.data.validUntil),
      issuedById: session.user.id,
      recipientId,
      recipientName: parsed.data.recipientName ?? null,
      siteId,
      status: "ISSUED",
    },
    select: { id: true },
  });

  revalidatePath("/permits");
  redirect(`/permits/${created.id}`);
}

export async function setPermitStatus(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (session.user.role !== "ORG_ADMIN") throw new Error("Forbidden");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as PermitStatus;
  const closedNotes = String(formData.get("closedNotes") ?? "") || null;
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error("Invalid input");
  }

  const permit = await prisma.permit.findUnique({ where: { id } });
  if (!permit) throw new Error("Not found");
  if (permit.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  await prisma.permit.update({
    where: { id },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null,
      closedNotes: status === "CLOSED" ? closedNotes : null,
    },
  });
  revalidatePath("/permits");
  revalidatePath(`/permits/${id}`);
}

export async function deletePermit(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const permit = await prisma.permit.findUnique({ where: { id } });
  if (!permit) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, permit.organizationId);
  await prisma.permit.delete({ where: { id } });
  revalidatePath("/permits");
  redirect("/permits");
}
