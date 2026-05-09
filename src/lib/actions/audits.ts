"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { AuditStatus } from "@prisma/client";

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function resolveSiteId(organizationId: string, siteIdRaw: string | null | undefined) {
  if (!siteIdRaw) return null;
  const site = await prisma.site.findUnique({ where: { id: siteIdRaw } });
  if (!site || site.organizationId !== organizationId) throw new Error("Invalid site");
  return site.id;
}

const intOrNull = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}, z.number().int().min(0).max(100000).nullable());

const auditSchema = z.object({
  title: z.string().trim().min(1).max(200),
  conductedAt: z.string().min(1),
  siteId: z.string().optional().nullable(),
  scoreNumerator: intOrNull,
  scoreDenominator: intOrNull,
  findings: z.string().max(20000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
});

export async function createAudit(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const parsed = auditSchema.safeParse({
    title: formData.get("title"),
    conductedAt: formData.get("conductedAt"),
    siteId: formData.get("siteId") || null,
    scoreNumerator: formData.get("scoreNumerator"),
    scoreDenominator: formData.get("scoreDenominator"),
    findings: formData.get("findings") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Title and date are required");

  const siteId = await resolveSiteId(session.user.organizationId, parsed.data.siteId);

  const templateIdRaw = (formData.get("templateId") as string | null) || null;
  let templateId: string | null = null;
  let templateItems: { id: string; label: string; position: number }[] = [];
  if (templateIdRaw) {
    const tpl = await prisma.auditTemplate.findUnique({
      where: { id: templateIdRaw },
      include: {
        items: {
          orderBy: { position: "asc" },
          select: { id: true, label: true, position: true },
        },
      },
    });
    if (!tpl || tpl.organizationId !== session.user.organizationId) {
      throw new Error("Invalid template");
    }
    templateId = tpl.id;
    templateItems = tpl.items;
  }

  const created = await prisma.audit.create({
    data: {
      organizationId: session.user.organizationId,
      title: parsed.data.title,
      conductedById: session.user.id,
      conductedAt: new Date(parsed.data.conductedAt),
      siteId,
      templateId,
      scoreNumerator: parsed.data.scoreNumerator,
      scoreDenominator: parsed.data.scoreDenominator,
      findings: parsed.data.findings ?? null,
      notes: parsed.data.notes ?? null,
    },
    select: { id: true },
  });

  if (templateItems.length > 0) {
    await prisma.auditFindingItem.createMany({
      data: templateItems.map((it) => ({
        auditId: created.id,
        label: it.label,
        position: it.position,
      })),
    });
  }

  revalidatePath("/audits");
  redirect(`/audits/${created.id}`);
}

export async function updateAudit(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, audit.organizationId);

  const parsed = auditSchema.safeParse({
    title: formData.get("title"),
    conductedAt: formData.get("conductedAt"),
    siteId: formData.get("siteId") || null,
    scoreNumerator: formData.get("scoreNumerator"),
    scoreDenominator: formData.get("scoreDenominator"),
    findings: formData.get("findings") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const siteId = await resolveSiteId(audit.organizationId, parsed.data.siteId);
  const status = String(formData.get("status") ?? audit.status) as AuditStatus;

  await prisma.audit.update({
    where: { id: audit.id },
    data: {
      title: parsed.data.title,
      conductedAt: new Date(parsed.data.conductedAt),
      siteId,
      scoreNumerator: parsed.data.scoreNumerator,
      scoreDenominator: parsed.data.scoreDenominator,
      findings: parsed.data.findings ?? null,
      notes: parsed.data.notes ?? null,
      status: status === "IN_PROGRESS" || status === "COMPLETED" ? status : audit.status,
    },
  });

  revalidatePath("/audits");
  revalidatePath(`/audits/${audit.id}`);
}

export async function deleteAudit(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, audit.organizationId);

  await prisma.audit.delete({ where: { id } });
  revalidatePath("/audits");
  redirect("/audits");
}
