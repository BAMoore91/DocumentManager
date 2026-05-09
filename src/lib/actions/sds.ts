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

async function uploadSdsFile(file: File, organizationId: string) {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(`sds/${organizationId}/${Date.now()}-${safeName}`, file, {
    access: "public",
    contentType: file.type || "application/pdf",
  });
  return {
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  };
}

const createSchema = z.object({
  productName: z.string().trim().min(1).max(200),
  manufacturer: z.string().max(200).optional().nullable(),
  casNumber: z.string().max(60).optional().nullable(),
  revisionDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function createSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId && session.user.role !== "SUPER_ADMIN") {
    throw new Error("No organization");
  }

  const parsed = createSchema.safeParse({
    productName: formData.get("productName"),
    manufacturer: formData.get("manufacturer") || null,
    casNumber: formData.get("casNumber") || null,
    revisionDate: formData.get("revisionDate") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Product name is required");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Upload an SDS file");

  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization");

  const fileFields = await uploadSdsFile(file, orgId);

  const created = await prisma.sdsSheet.create({
    data: {
      productName: parsed.data.productName,
      manufacturer: parsed.data.manufacturer ?? null,
      casNumber: parsed.data.casNumber ?? null,
      revisionDate: parsed.data.revisionDate ? new Date(parsed.data.revisionDate) : null,
      notes: parsed.data.notes ?? null,
      organizationId: orgId,
      uploadedById: session.user.id,
      ...fileFields,
    },
    select: { id: true },
  });

  revalidatePath("/sds");
  redirect(`/sds/${created.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  productName: z.string().trim().min(1).max(200),
  manufacturer: z.string().max(200).optional().nullable(),
  casNumber: z.string().max(60).optional().nullable(),
  revisionDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function updateSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    productName: formData.get("productName"),
    manufacturer: formData.get("manufacturer") || null,
    casNumber: formData.get("casNumber") || null,
    revisionDate: formData.get("revisionDate") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id: parsed.data.id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  let fileFields: Awaited<ReturnType<typeof uploadSdsFile>> | null = null;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    if (sheet.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(sheet.fileUrl);
      } catch {
        // ignore blob delete errors
      }
    }
    fileFields = await uploadSdsFile(file, sheet.organizationId);
  }

  await prisma.sdsSheet.update({
    where: { id: sheet.id },
    data: {
      productName: parsed.data.productName,
      manufacturer: parsed.data.manufacturer ?? null,
      casNumber: parsed.data.casNumber ?? null,
      revisionDate: parsed.data.revisionDate ? new Date(parsed.data.revisionDate) : null,
      notes: parsed.data.notes ?? null,
      ...(fileFields ?? {}),
    },
  });

  revalidatePath("/sds");
  revalidatePath(`/sds/${sheet.id}`);
}

export async function deleteSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  if (sheet.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(sheet.fileUrl);
    } catch {
      // ignore blob delete errors
    }
  }

  await prisma.sdsSheet.delete({ where: { id } });

  revalidatePath("/sds");
  redirect("/sds");
}
