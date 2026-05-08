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

async function uploadAttachment(file: File, organizationId: string) {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(`kb/${organizationId}/${Date.now()}-${safeName}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });
  return {
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

const createSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50000),
});

export async function createKbArticle(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = createSchema.safeParse({
    organizationId: formData.get("organizationId"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) throw new Error("Title is required");
  const { organizationId, title, body } = parsed.data;

  await assertOrgAccess(session.user.role, session.user.organizationId, organizationId);

  const file = formData.get("file") as File | null;
  let fileFields: Awaited<ReturnType<typeof uploadAttachment>> | null = null;
  if (file && file.size > 0) {
    fileFields = await uploadAttachment(file, organizationId);
  }

  const created = await prisma.kbArticle.create({
    data: {
      organizationId,
      title,
      body,
      authorId: session.user.id,
      fileUrl: fileFields?.fileUrl ?? null,
      fileName: fileFields?.fileName ?? null,
      fileSize: fileFields?.fileSize ?? null,
      mimeType: fileFields?.mimeType ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/admin/settings/kb");
  revalidatePath("/kb");
  redirect(`/admin/settings/kb/${created.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50000),
});

export async function updateKbArticle(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) throw new Error("Title is required");

  const article = await prisma.kbArticle.findUnique({ where: { id: parsed.data.id } });
  if (!article) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, article.organizationId);

  let fileFields: Awaited<ReturnType<typeof uploadAttachment>> | null = null;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    if (article.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(article.fileUrl);
      } catch {
        // ignore blob delete errors
      }
    }
    fileFields = await uploadAttachment(file, article.organizationId);
  }

  await prisma.kbArticle.update({
    where: { id: article.id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      ...(fileFields ?? {}),
    },
  });

  revalidatePath("/admin/settings/kb");
  revalidatePath(`/admin/settings/kb/${article.id}`);
  revalidatePath("/kb");
  revalidatePath(`/kb/${article.id}`);
}

export async function deleteKbArticle(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const article = await prisma.kbArticle.findUnique({ where: { id } });
  if (!article) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, article.organizationId);

  if (article.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(article.fileUrl);
    } catch {
      // ignore blob delete errors
    }
  }

  await prisma.kbArticle.delete({ where: { id } });

  revalidatePath("/admin/settings/kb");
  revalidatePath("/kb");
}

export async function setKbArticlePublished(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "true";
  if (!id) throw new Error("Missing id");

  const article = await prisma.kbArticle.findUnique({ where: { id } });
  if (!article) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, article.organizationId);

  await prisma.kbArticle.update({ where: { id }, data: { published } });

  revalidatePath("/admin/settings/kb");
  revalidatePath(`/admin/settings/kb/${id}`);
  revalidatePath("/kb");
  revalidatePath(`/kb/${id}`);
}

export async function removeKbArticleFile(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const article = await prisma.kbArticle.findUnique({ where: { id } });
  if (!article) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, article.organizationId);

  if (article.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(article.fileUrl);
    } catch {
      // ignore blob delete errors
    }
  }

  await prisma.kbArticle.update({
    where: { id },
    data: { fileUrl: null, fileName: null, fileSize: null, mimeType: null },
  });

  revalidatePath(`/admin/settings/kb/${id}`);
}
