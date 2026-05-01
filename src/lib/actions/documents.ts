"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";

const MAX_BYTES = 15 * 1024 * 1024;

const docSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  expirationDate: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  ownerId: z.string().min(1),
});

export async function uploadDocument(formData: FormData) {
  const session = await requireAuth();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "File is required" };
  if (file.size > MAX_BYTES) return { error: "File exceeds 15 MB limit" };

  const parsed = docSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    expirationDate: formData.get("expirationDate"),
    notes: formData.get("notes") ?? null,
    ownerId: formData.get("ownerId") ?? session.user.id,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const owner = await prisma.user.findUnique({ where: { id: parsed.data.ownerId } });
  if (!owner) return { error: "Owner not found" };

  if (session.user.role === "USER") {
    if (owner.id !== session.user.id) return { error: "Forbidden" };
  } else if (session.user.role === "ORG_ADMIN") {
    if (owner.organizationId !== session.user.organizationId) return { error: "Forbidden" };
  }

  if (!owner.organizationId) return { error: "Owner has no organization" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { error: "File storage is not configured. Set BLOB_READ_WRITE_TOKEN." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(`org/${owner.organizationId}/${owner.id}/${Date.now()}-${safeName}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  await prisma.document.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      expirationDate: new Date(parsed.data.expirationDate),
      notes: parsed.data.notes ?? null,
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      organizationId: owner.organizationId,
      ownerId: owner.id,
      uploadedById: session.user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/documents");
  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath("/super-admin");
  return { success: true };
}

export async function deleteDocument(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: "Not found" };

  if (session.user.role === "USER" && doc.ownerId !== session.user.id) return { error: "Forbidden" };
  if (
    session.user.role === "ORG_ADMIN" &&
    doc.organizationId !== session.user.organizationId
  )
    return { error: "Forbidden" };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(doc.fileUrl);
    } catch {
      // ignore blob deletion errors
    }
  }
  await prisma.document.delete({ where: { id } });

  revalidatePath("/admin/documents");
  revalidatePath("/documents");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/super-admin");
  return { success: true };
}

export async function updateExpiration(formData: FormData) {
  const session = await requireRole("ORG_ADMIN", "SUPER_ADMIN", "USER");
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("expirationDate") ?? "");
  if (!id || !date) return { error: "Missing input" };

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: "Not found" };
  if (session.user.role === "USER" && doc.ownerId !== session.user.id) return { error: "Forbidden" };
  if (
    session.user.role === "ORG_ADMIN" &&
    doc.organizationId !== session.user.organizationId
  )
    return { error: "Forbidden" };

  await prisma.document.update({ where: { id }, data: { expirationDate: new Date(date) } });
  revalidatePath("/admin/documents");
  revalidatePath("/documents");
  return { success: true };
}
