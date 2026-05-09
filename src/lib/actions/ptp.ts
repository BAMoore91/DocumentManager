"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { PtpStatus } from "@prisma/client";

async function resolveSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

const ptpSchema = z.object({
  title: z.string().trim().min(1).max(200),
  task: z.string().trim().min(1).max(2000),
  date: z.string().min(1),
  siteId: z.string().optional().nullable(),
  hazards: z.string().trim().min(1).max(20000),
  controls: z.string().trim().min(1).max(20000),
  ppe: z.string().max(2000).optional().nullable(),
  emergencyInfo: z.string().max(2000).optional().nullable(),
});

async function ensureCanEdit(
  ptpId: string,
  sessionUserId: string,
  sessionRole: string,
  sessionOrgId: string | null,
) {
  const ptp = await prisma.preTaskPlan.findUnique({ where: { id: ptpId } });
  if (!ptp) throw new Error("Not found");
  if (ptp.organizationId !== sessionOrgId) throw new Error("Forbidden");
  if (sessionRole !== "ORG_ADMIN" && ptp.createdById !== sessionUserId) {
    throw new Error("Forbidden");
  }
  return ptp;
}

export async function createPreTaskPlan(formData: FormData): Promise<void> {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error("No organization");
  const parsed = ptpSchema.safeParse({
    title: formData.get("title"),
    task: formData.get("task"),
    date: formData.get("date"),
    siteId: formData.get("siteId") || null,
    hazards: formData.get("hazards"),
    controls: formData.get("controls"),
    ppe: formData.get("ppe") || null,
    emergencyInfo: formData.get("emergencyInfo") || null,
  });
  if (!parsed.success) throw new Error("Title, task, hazards, and controls are required");

  const siteId = await resolveSiteId(session.user.organizationId, parsed.data.siteId);

  const created = await prisma.preTaskPlan.create({
    data: {
      organizationId: session.user.organizationId,
      title: parsed.data.title,
      task: parsed.data.task,
      date: new Date(parsed.data.date),
      siteId,
      hazards: parsed.data.hazards,
      controls: parsed.data.controls,
      ppe: parsed.data.ppe ?? null,
      emergencyInfo: parsed.data.emergencyInfo ?? null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/ptp");
  redirect(`/ptp/${created.id}`);
}

export async function updatePreTaskPlan(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const ptp = await ensureCanEdit(id, session.user.id, session.user.role, session.user.organizationId);

  const parsed = ptpSchema.safeParse({
    title: formData.get("title"),
    task: formData.get("task"),
    date: formData.get("date"),
    siteId: formData.get("siteId") || null,
    hazards: formData.get("hazards"),
    controls: formData.get("controls"),
    ppe: formData.get("ppe") || null,
    emergencyInfo: formData.get("emergencyInfo") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const siteId = await resolveSiteId(ptp.organizationId, parsed.data.siteId);
  const status = String(formData.get("status") ?? ptp.status) as PtpStatus;

  await prisma.preTaskPlan.update({
    where: { id: ptp.id },
    data: {
      title: parsed.data.title,
      task: parsed.data.task,
      date: new Date(parsed.data.date),
      siteId,
      hazards: parsed.data.hazards,
      controls: parsed.data.controls,
      ppe: parsed.data.ppe ?? null,
      emergencyInfo: parsed.data.emergencyInfo ?? null,
      status: ["DRAFT", "ACTIVE", "COMPLETED"].includes(status) ? status : ptp.status,
    },
  });

  revalidatePath("/ptp");
  revalidatePath(`/ptp/${ptp.id}`);
}

export async function deletePreTaskPlan(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const ptp = await ensureCanEdit(id, session.user.id, session.user.role, session.user.organizationId);
  await prisma.preTaskPlan.delete({ where: { id: ptp.id } });
  revalidatePath("/ptp");
  redirect("/ptp");
}

export async function acknowledgePtp(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const ptp = await prisma.preTaskPlan.findUnique({ where: { id } });
  if (!ptp) throw new Error("Not found");
  if (ptp.organizationId !== session.user.organizationId) throw new Error("Forbidden");

  const ack = await prisma.ptpAcknowledgement.upsert({
    where: { preTaskPlanId_userId: { preTaskPlanId: ptp.id, userId: session.user.id } },
    update: {},
    create: { preTaskPlanId: ptp.id, userId: session.user.id },
  });

  const signatureDataUrl = String(formData.get("signature") ?? "");
  if (signatureDataUrl.startsWith("data:image/")) {
    await prisma.signature.create({
      data: {
        signerId: session.user.id,
        signerName: session.user.name ?? session.user.email ?? "Member",
        contextType: "PTP_ACKNOWLEDGEMENT",
        contextId: ack.id,
        imageDataUrl: signatureDataUrl,
      },
    });
  }

  revalidatePath(`/ptp/${ptp.id}`);
}
