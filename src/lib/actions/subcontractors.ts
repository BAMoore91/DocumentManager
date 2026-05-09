"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const MAX_BYTES = 15 * 1024 * 1024;

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function uploadCoi(file: File, organizationId: string) {
  if (file.size > MAX_BYTES) throw new Error("Insurance certificate exceeds 15 MB");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(
    `subcontractors/${organizationId}/${Date.now()}-${safeName}`,
    file,
    {
      access: "public",
      contentType: file.type || "application/pdf",
    },
  );
  return {
    insuranceUrl: blob.url,
    insuranceName: file.name,
    insuranceSize: file.size,
  };
}

const subSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(60).optional().nullable(),
  trade: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  insuranceExpiresAt: z.string().optional().nullable(),
  prequalified: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export async function createSubcontractor(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const parsed = subSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || null,
    contactEmail: formData.get("contactEmail") || null,
    contactPhone: formData.get("contactPhone") || null,
    trade: formData.get("trade") || null,
    notes: formData.get("notes") || null,
    insuranceExpiresAt: formData.get("insuranceExpiresAt") || null,
    prequalified: formData.get("prequalified"),
  });
  if (!parsed.success) throw new Error("Subcontractor name is required");

  let coiFields = {} as Awaited<ReturnType<typeof uploadCoi>>;
  const file = formData.get("insurance") as File | null;
  if (file && file.size > 0) {
    coiFields = await uploadCoi(file, session.user.organizationId);
  }

  try {
    await prisma.subcontractor.create({
      data: {
        organizationId: session.user.organizationId,
        name: parsed.data.name,
        contactName: parsed.data.contactName ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
        trade: parsed.data.trade ?? null,
        notes: parsed.data.notes ?? null,
        insuranceExpiresAt: parsed.data.insuranceExpiresAt
          ? new Date(parsed.data.insuranceExpiresAt)
          : null,
        prequalified: parsed.data.prequalified,
        prequalifiedAt: parsed.data.prequalified ? new Date() : null,
        ...coiFields,
      },
    });
  } catch {
    throw new Error("A subcontractor with that name already exists");
  }

  revalidatePath("/admin/subcontractors");
}

export async function updateSubcontractor(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const sub = await prisma.subcontractor.findUnique({ where: { id } });
  if (!sub) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sub.organizationId);

  const parsed = subSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || null,
    contactEmail: formData.get("contactEmail") || null,
    contactPhone: formData.get("contactPhone") || null,
    trade: formData.get("trade") || null,
    notes: formData.get("notes") || null,
    insuranceExpiresAt: formData.get("insuranceExpiresAt") || null,
    prequalified: formData.get("prequalified"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  let coiFields = {} as Awaited<ReturnType<typeof uploadCoi>>;
  const file = formData.get("insurance") as File | null;
  if (file && file.size > 0) {
    if (sub.insuranceUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(sub.insuranceUrl);
      } catch {
        // ignore
      }
    }
    coiFields = await uploadCoi(file, sub.organizationId);
  }

  await prisma.subcontractor.update({
    where: { id: sub.id },
    data: {
      name: parsed.data.name,
      contactName: parsed.data.contactName ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      trade: parsed.data.trade ?? null,
      notes: parsed.data.notes ?? null,
      insuranceExpiresAt: parsed.data.insuranceExpiresAt
        ? new Date(parsed.data.insuranceExpiresAt)
        : null,
      prequalified: parsed.data.prequalified,
      prequalifiedAt:
        parsed.data.prequalified && !sub.prequalifiedAt
          ? new Date()
          : parsed.data.prequalified
            ? sub.prequalifiedAt
            : null,
      ...coiFields,
    },
  });

  revalidatePath("/admin/subcontractors");
}

export async function deleteSubcontractor(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const sub = await prisma.subcontractor.findUnique({ where: { id } });
  if (!sub) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sub.organizationId);

  if (sub.insuranceUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(sub.insuranceUrl);
    } catch {
      // ignore
    }
  }

  await prisma.subcontractor.delete({ where: { id } });
  revalidatePath("/admin/subcontractors");
  redirect("/admin/subcontractors");
}
