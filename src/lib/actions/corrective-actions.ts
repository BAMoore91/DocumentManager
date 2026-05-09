"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyCapaAssigned } from "@/lib/notifications";
import type {
  CorrectiveActionPriority,
  CorrectiveActionSourceType,
  CorrectiveActionStatus,
} from "@prisma/client";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "VERIFIED", "CLOSED"] as const;
const SOURCES = ["JHA", "INCIDENT", "AUDIT", "OBSERVATION", "OTHER"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  sourceType: z.enum(SOURCES),
  sourceId: z.string().max(60).optional().nullable(),
  priority: z.enum(PRIORITIES),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

async function ensureCanEdit(
  capaId: string,
  sessionUserId: string,
  sessionRole: string,
  sessionOrgId: string | null,
) {
  const capa = await prisma.correctiveAction.findUnique({ where: { id: capaId } });
  if (!capa) throw new Error("Not found");
  if (capa.organizationId !== sessionOrgId) throw new Error("Forbidden");
  if (sessionRole !== "ORG_ADMIN" && capa.createdById !== sessionUserId) {
    throw new Error("Forbidden");
  }
  return capa;
}

async function resolveAssignee(
  organizationId: string,
  assignedToIdRaw: string | null | undefined,
): Promise<string | null> {
  if (!assignedToIdRaw) return null;
  const found = await prisma.user.findUnique({
    where: { id: assignedToIdRaw },
    select: { organizationId: true },
  });
  if (!found || found.organizationId !== organizationId) {
    throw new Error("Invalid assignee");
  }
  return assignedToIdRaw;
}

export async function createCorrectiveAction(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    sourceType: formData.get("sourceType") || "OTHER",
    sourceId: formData.get("sourceId") || null,
    priority: formData.get("priority") || "MEDIUM",
    assignedToId: formData.get("assignedToId") || null,
    dueDate: formData.get("dueDate") || null,
  });
  if (!parsed.success) throw new Error("Title, source, and priority are required");

  const assignedToId = await resolveAssignee(
    session.user.organizationId,
    parsed.data.assignedToId,
  );

  const created = await prisma.correctiveAction.create({
    data: {
      organizationId: session.user.organizationId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sourceType: parsed.data.sourceType as CorrectiveActionSourceType,
      sourceId: parsed.data.sourceId ?? null,
      priority: parsed.data.priority as CorrectiveActionPriority,
      assignedToId,
      createdById: session.user.id,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
    select: { id: true, title: true, dueDate: true },
  });

  if (assignedToId && assignedToId !== session.user.id) {
    await notifyCapaAssigned(assignedToId, created);
  }

  revalidatePath("/corrective-actions");
  redirect(`/corrective-actions/${created.id}`);
}

const updateSchema = createSchema.extend({ id: z.string().min(1) });

export async function updateCorrectiveAction(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    sourceType: formData.get("sourceType") || "OTHER",
    sourceId: formData.get("sourceId") || null,
    priority: formData.get("priority") || "MEDIUM",
    assignedToId: formData.get("assignedToId") || null,
    dueDate: formData.get("dueDate") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const capa = await ensureCanEdit(
    parsed.data.id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  const newAssigneeId = await resolveAssignee(capa.organizationId, parsed.data.assignedToId);

  const updated = await prisma.correctiveAction.update({
    where: { id: capa.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sourceType: parsed.data.sourceType as CorrectiveActionSourceType,
      sourceId: parsed.data.sourceId ?? null,
      priority: parsed.data.priority as CorrectiveActionPriority,
      assignedToId: newAssigneeId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
    select: { id: true, title: true, dueDate: true },
  });

  if (
    newAssigneeId &&
    newAssigneeId !== capa.assignedToId &&
    newAssigneeId !== session.user.id
  ) {
    await notifyCapaAssigned(newAssigneeId, updated);
  }

  revalidatePath("/corrective-actions");
  revalidatePath(`/corrective-actions/${capa.id}`);
}

export async function setCorrectiveActionStatus(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as CorrectiveActionStatus;
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error("Invalid input");
  }

  const capa = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!capa) throw new Error("Not found");
  if (capa.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  const isAdmin = session.user.role === "ORG_ADMIN";
  const isAssignee = capa.assignedToId === session.user.id;

  // Verification & closure must be admin
  if ((status === "VERIFIED" || status === "CLOSED") && !isAdmin) {
    throw new Error("Only an Org Admin can verify or close a corrective action");
  }
  if (!isAdmin && !isAssignee && capa.createdById !== session.user.id) {
    throw new Error("Forbidden");
  }

  const verificationNotes = String(formData.get("verificationNotes") ?? "") || null;

  await prisma.correctiveAction.update({
    where: { id },
    data: {
      status,
      verifiedById:
        status === "VERIFIED" || status === "CLOSED" ? session.user.id : capa.verifiedById,
      verifiedAt:
        status === "VERIFIED" || status === "CLOSED"
          ? capa.verifiedAt ?? new Date()
          : capa.verifiedAt,
      verificationNotes:
        verificationNotes ?? capa.verificationNotes,
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });

  revalidatePath("/corrective-actions");
  revalidatePath(`/corrective-actions/${id}`);
}

export async function deleteCorrectiveAction(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const capa = await ensureCanEdit(
    id,
    session.user.id,
    session.user.role,
    session.user.organizationId,
  );

  await prisma.notification.deleteMany({
    where: { sourceId: capa.id, type: "CAPA_ASSIGNED" },
  });
  await prisma.correctiveAction.delete({ where: { id: capa.id } });

  revalidatePath("/corrective-actions");
  redirect("/corrective-actions");
}
