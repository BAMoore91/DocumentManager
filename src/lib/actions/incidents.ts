"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { recordAction } from "@/lib/audit-log";
import type { IncidentStatus, IncidentType } from "@prisma/client";

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = [
  "NEAR_MISS",
  "FIRST_AID",
  "RECORDABLE",
  "RESTRICTED_DUTY",
  "LOST_TIME",
  "FATALITY",
] as const;
const STATUSES = ["OPEN", "UNDER_REVIEW", "CLOSED"] as const;

const intOrNull = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}, z.number().int().min(0).max(9999).nullable());

const createSchema = z.object({
  type: z.enum(TYPES),
  occurredAt: z.string().min(1),
  caseNumber: z.string().max(60).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().trim().min(1).max(20000),
  personName: z.string().trim().min(1).max(200),
  personUserId: z.string().optional().nullable(),
  jobTitle: z.string().max(120).optional().nullable(),
  bodyPart: z.string().max(120).optional().nullable(),
  injuryType: z.string().max(120).optional().nullable(),
  daysAway: intOrNull,
  daysRestricted: intOrNull,
  treatmentReceived: z.string().max(2000).optional().nullable(),
  rootCause: z.string().max(5000).optional().nullable(),
  correctiveActions: z.string().max(5000).optional().nullable(),
});

async function uploadIncidentPhoto(
  file: File,
  organizationId: string,
  incidentId: string,
) {
  if (file.size > MAX_BYTES) throw new Error("Photo exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(
    `incidents/${organizationId}/${incidentId}/${Date.now()}-${safeName}`,
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
  incidentId: string,
  sessionUserId: string,
  sessionRole: string,
  sessionOrgId: string | null,
) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new Error("Not found");
  if (incident.organizationId !== sessionOrgId) throw new Error("Forbidden");
  if (sessionRole !== "ORG_ADMIN" && incident.reportedById !== sessionUserId) {
    throw new Error("Forbidden");
  }
  return incident;
}

async function resolvePersonUserId(
  organizationId: string,
  personUserIdRaw: string | null | undefined,
): Promise<string | null> {
  if (!personUserIdRaw) return null;
  const found = await prisma.user.findUnique({
    where: { id: personUserIdRaw },
    select: { organizationId: true },
  });
  if (!found || found.organizationId !== organizationId) {
    throw new Error("Invalid person involved");
  }
  return personUserIdRaw;
}

export async function createIncident(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = createSchema.safeParse({
    type: formData.get("type") || "NEAR_MISS",
    occurredAt: formData.get("occurredAt"),
    caseNumber: formData.get("caseNumber") || null,
    location: formData.get("location") || null,
    description: formData.get("description"),
    personName: formData.get("personName"),
    personUserId: formData.get("personUserId") || null,
    jobTitle: formData.get("jobTitle") || null,
    bodyPart: formData.get("bodyPart") || null,
    injuryType: formData.get("injuryType") || null,
    daysAway: formData.get("daysAway"),
    daysRestricted: formData.get("daysRestricted"),
    treatmentReceived: formData.get("treatmentReceived") || null,
    rootCause: formData.get("rootCause") || null,
    correctiveActions: formData.get("correctiveActions") || null,
  });
  if (!parsed.success) {
    throw new Error("Type, occurred date, description, and person name are required");
  }

  const personUserId = await resolvePersonUserId(
    session.user.organizationId,
    parsed.data.personUserId ?? null,
  );

  const created = await prisma.incident.create({
    data: {
      organizationId: session.user.organizationId,
      type: parsed.data.type as IncidentType,
      occurredAt: new Date(parsed.data.occurredAt),
      caseNumber: parsed.data.caseNumber ?? null,
      location: parsed.data.location ?? null,
      description: parsed.data.description,
      personName: parsed.data.personName,
      personUserId,
      jobTitle: parsed.data.jobTitle ?? null,
      bodyPart: parsed.data.bodyPart ?? null,
      injuryType: parsed.data.injuryType ?? null,
      daysAway: parsed.data.daysAway,
      daysRestricted: parsed.data.daysRestricted,
      treatmentReceived: parsed.data.treatmentReceived ?? null,
      rootCause: parsed.data.rootCause ?? null,
      correctiveActions: parsed.data.correctiveActions ?? null,
      reportedById: session.user.id,
    },
    select: { id: true, organizationId: true },
  });

  const photos = formData
    .getAll("photos")
    .filter((p): p is File => p instanceof File && p.size > 0);
  for (const photo of photos) {
    const fields = await uploadIncidentPhoto(photo, created.organizationId, created.id);
    await prisma.incidentPhoto.create({ data: { incidentId: created.id, ...fields } });
  }

  await recordAction({
    organizationId: created.organizationId,
    userId: session.user.id,
    action: "incident.create",
    summary: `Reported ${parsed.data.type.replace(/_/g, " ").toLowerCase()} incident for ${parsed.data.personName}`,
    entityType: "Incident",
    entityId: created.id,
  });

  revalidatePath("/incidents");
  redirect(`/incidents/${created.id}`);
}

const updateSchema = createSchema.extend({ id: z.string().min(1) });

export async function updateIncident(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    type: formData.get("type") || "NEAR_MISS",
    occurredAt: formData.get("occurredAt"),
    caseNumber: formData.get("caseNumber") || null,
    location: formData.get("location") || null,
    description: formData.get("description"),
    personName: formData.get("personName"),
    personUserId: formData.get("personUserId") || null,
    jobTitle: formData.get("jobTitle") || null,
    bodyPart: formData.get("bodyPart") || null,
    injuryType: formData.get("injuryType") || null,
    daysAway: formData.get("daysAway"),
    daysRestricted: formData.get("daysRestricted"),
    treatmentReceived: formData.get("treatmentReceived") || null,
    rootCause: formData.get("rootCause") || null,
    correctiveActions: formData.get("correctiveActions") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const incident = await ensureCanEdit(
    parsed.data.id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  const personUserId = await resolvePersonUserId(
    incident.organizationId,
    parsed.data.personUserId ?? null,
  );

  await prisma.incident.update({
    where: { id: incident.id },
    data: {
      type: parsed.data.type as IncidentType,
      occurredAt: new Date(parsed.data.occurredAt),
      caseNumber: parsed.data.caseNumber ?? null,
      location: parsed.data.location ?? null,
      description: parsed.data.description,
      personName: parsed.data.personName,
      personUserId,
      jobTitle: parsed.data.jobTitle ?? null,
      bodyPart: parsed.data.bodyPart ?? null,
      injuryType: parsed.data.injuryType ?? null,
      daysAway: parsed.data.daysAway,
      daysRestricted: parsed.data.daysRestricted,
      treatmentReceived: parsed.data.treatmentReceived ?? null,
      rootCause: parsed.data.rootCause ?? null,
      correctiveActions: parsed.data.correctiveActions ?? null,
    },
  });

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incident.id}`);
}

export async function setIncidentStatus(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (session.user.role !== "ORG_ADMIN") throw new Error("Forbidden");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as IncidentStatus;
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error("Invalid input");
  }

  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw new Error("Not found");
  if (incident.organizationId !== session.user.organizationId) {
    throw new Error("Forbidden");
  }

  await prisma.incident.update({
    where: { id },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });

  await recordAction({
    organizationId: incident.organizationId,
    userId: session.user.id,
    action: "incident.status",
    summary: `Set incident "${incident.personName}" to ${status.replace(/_/g, " ").toLowerCase()}`,
    entityType: "Incident",
    entityId: incident.id,
  });

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${id}`);
}

export async function deleteIncident(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const incident = await ensureCanEdit(
    id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const photos = await prisma.incidentPhoto.findMany({
      where: { incidentId: incident.id },
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

  await prisma.incident.delete({ where: { id: incident.id } });

  await recordAction({
    organizationId: incident.organizationId,
    userId: session.user.id,
    action: "incident.delete",
    summary: `Deleted incident report for ${incident.personName}`,
    entityType: "Incident",
    entityId: incident.id,
  });

  revalidatePath("/incidents");
  redirect("/incidents");
}

export async function addIncidentPhotos(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const incident = await ensureCanEdit(
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
    const fields = await uploadIncidentPhoto(photo, incident.organizationId, incident.id);
    await prisma.incidentPhoto.create({ data: { incidentId: incident.id, ...fields } });
  }

  revalidatePath(`/incidents/${incident.id}`);
}

export async function removeIncidentPhoto(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const photo = await prisma.incidentPhoto.findUnique({
    where: { id },
    include: { incident: true },
  });
  if (!photo) throw new Error("Not found");
  if (photo.incident.organizationId !== session.user.organizationId) {
    throw new Error("Forbidden");
  }
  if (
    session.user.role !== "ORG_ADMIN" &&
    photo.incident.reportedById !== session.user.id
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

  await prisma.incidentPhoto.delete({ where: { id } });

  revalidatePath(`/incidents/${photo.incidentId}`);
}
