"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { JhaSeverity, JhaStatus } from "@prisma/client";

const MAX_BYTES = 15 * 1024 * 1024;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  hazardDescription: z.string().trim().min(1).max(10000),
  mitigation: z.string().max(10000).optional().nullable(),
  severity: z.enum(SEVERITIES),
  siteId: z.string().optional().nullable(),
});

async function resolveJhaSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

async function uploadPhoto(file: File, organizationId: string, jhaId: string) {
  if (file.size > MAX_BYTES) throw new Error("Photo exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(
    `jha/${organizationId}/${jhaId}/${Date.now()}-${safeName}`,
    file,
    {
      access: "public",
      contentType: file.type || "application/octet-stream",
    },
  );
  return {
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

async function ensureCanEdit(
  reportId: string,
  sessionUserId: string,
  sessionRole: string,
  sessionOrgId: string | null,
) {
  const report = await prisma.jhaReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Not found");
  if (report.organizationId !== sessionOrgId) throw new Error("Forbidden");
  if (sessionRole !== "ORG_ADMIN" && report.reportedById !== sessionUserId) {
    throw new Error("Forbidden");
  }
  return report;
}

export async function createJhaReport(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    location: formData.get("location") || null,
    hazardDescription: formData.get("hazardDescription"),
    mitigation: formData.get("mitigation") || null,
    severity: formData.get("severity") || "MEDIUM",
    siteId: formData.get("siteId") || null,
  });
  if (!parsed.success) {
    throw new Error("Title, hazard description, and severity are required");
  }

  const siteId = await resolveJhaSiteId(session.user.organizationId, parsed.data.siteId);

  const created = await prisma.jhaReport.create({
    data: {
      title: parsed.data.title,
      location: parsed.data.location ?? null,
      hazardDescription: parsed.data.hazardDescription,
      mitigation: parsed.data.mitigation ?? null,
      severity: parsed.data.severity as JhaSeverity,
      organizationId: session.user.organizationId,
      reportedById: session.user.id,
      siteId,
    },
    select: { id: true, organizationId: true },
  });

  const photos = formData
    .getAll("photos")
    .filter((p): p is File => p instanceof File && p.size > 0);
  for (const photo of photos) {
    const fields = await uploadPhoto(photo, created.organizationId, created.id);
    await prisma.jhaPhoto.create({ data: { jhaId: created.id, ...fields } });
  }

  revalidatePath("/jha");
  redirect(`/jha/${created.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  hazardDescription: z.string().trim().min(1).max(10000),
  mitigation: z.string().max(10000).optional().nullable(),
  severity: z.enum(SEVERITIES),
  siteId: z.string().optional().nullable(),
});

export async function updateJhaReport(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    location: formData.get("location") || null,
    hazardDescription: formData.get("hazardDescription"),
    mitigation: formData.get("mitigation") || null,
    severity: formData.get("severity") || "MEDIUM",
    siteId: formData.get("siteId") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const report = await ensureCanEdit(
    parsed.data.id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  const siteId = await resolveJhaSiteId(report.organizationId, parsed.data.siteId);

  await prisma.jhaReport.update({
    where: { id: report.id },
    data: {
      title: parsed.data.title,
      location: parsed.data.location ?? null,
      hazardDescription: parsed.data.hazardDescription,
      mitigation: parsed.data.mitigation ?? null,
      severity: parsed.data.severity as JhaSeverity,
      siteId,
    },
  });

  revalidatePath("/jha");
  revalidatePath(`/jha/${report.id}`);
}

export async function setJhaStatus(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as JhaStatus;
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error("Invalid input");
  }
  if (session.user.role !== "ORG_ADMIN") throw new Error("Forbidden");

  const report = await prisma.jhaReport.findUnique({ where: { id } });
  if (!report) throw new Error("Not found");
  if (report.organizationId !== session.user.organizationId) {
    throw new Error("Forbidden");
  }

  await prisma.jhaReport.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    },
  });

  revalidatePath("/jha");
  revalidatePath(`/jha/${id}`);
}

export async function deleteJhaReport(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const report = await ensureCanEdit(
    id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const photos = await prisma.jhaPhoto.findMany({
      where: { jhaId: report.id },
      select: { fileUrl: true },
    });
    for (const p of photos) {
      try {
        await del(p.fileUrl);
      } catch {
        // ignore blob errors
      }
    }
  }

  await prisma.jhaReport.delete({ where: { id: report.id } });

  revalidatePath("/jha");
  redirect("/jha");
}

export async function addJhaPhotos(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const report = await ensureCanEdit(
    id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  const photos = formData
    .getAll("photos")
    .filter((p): p is File => p instanceof File && p.size > 0);
  if (photos.length === 0) throw new Error("Choose at least one photo");

  for (const photo of photos) {
    const fields = await uploadPhoto(photo, report.organizationId, report.id);
    await prisma.jhaPhoto.create({ data: { jhaId: report.id, ...fields } });
  }

  revalidatePath(`/jha/${report.id}`);
}

export async function removeJhaPhoto(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const photo = await prisma.jhaPhoto.findUnique({
    where: { id },
    include: { jha: true },
  });
  if (!photo) throw new Error("Not found");
  if (photo.jha.organizationId !== session.user.organizationId) {
    throw new Error("Forbidden");
  }
  if (
    session.user.role !== "ORG_ADMIN" &&
    photo.jha.reportedById !== session.user.id
  ) {
    throw new Error("Forbidden");
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(photo.fileUrl);
    } catch {
      // ignore blob errors
    }
  }

  await prisma.jhaPhoto.delete({ where: { id } });

  revalidatePath(`/jha/${photo.jhaId}`);
}
