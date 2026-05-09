"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

const templateSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
});

export async function createAuditTemplate(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = templateSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (!parsed.success) throw new Error("Template name is required");
  await assertOrgAccess(session.user.role, session.user.organizationId, parsed.data.organizationId);

  try {
    await prisma.auditTemplate.create({
      data: {
        organizationId: parsed.data.organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
  } catch {
    throw new Error("A template with that name already exists");
  }

  revalidatePath("/admin/settings/audit-templates");
}

export async function updateAuditTemplate(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const tpl = await prisma.auditTemplate.findUnique({ where: { id } });
  if (!tpl) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, tpl.organizationId);

  const parsed = templateSchema.safeParse({
    organizationId: tpl.organizationId,
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  await prisma.auditTemplate.update({
    where: { id: tpl.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
  });
  revalidatePath("/admin/settings/audit-templates");
  revalidatePath(`/admin/settings/audit-templates/${tpl.id}`);
}

export async function deleteAuditTemplate(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const tpl = await prisma.auditTemplate.findUnique({ where: { id } });
  if (!tpl) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, tpl.organizationId);

  await prisma.auditTemplate.delete({ where: { id } });
  revalidatePath("/admin/settings/audit-templates");
}

export async function addAuditTemplateItem(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const templateId = String(formData.get("templateId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!templateId || !label) throw new Error("Item label is required");

  const tpl = await prisma.auditTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error("Template not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, tpl.organizationId);

  const last = await prisma.auditTemplateItem.findFirst({
    where: { templateId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.auditTemplateItem.create({
    data: {
      templateId,
      label: label.slice(0, 300),
      position: (last?.position ?? -1) + 1,
    },
  });
  revalidatePath(`/admin/settings/audit-templates/${templateId}`);
}

export async function deleteAuditTemplateItem(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const item = await prisma.auditTemplateItem.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!item) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, item.template.organizationId);

  await prisma.auditTemplateItem.delete({ where: { id } });
  revalidatePath(`/admin/settings/audit-templates/${item.template.id}`);
}

const findingSchema = z.object({
  auditId: z.string().min(1),
});

export async function recordAuditFinding(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const itemId = String(formData.get("itemId") ?? "");
  const result = String(formData.get("result") ?? "");
  const notes = String(formData.get("notes") ?? "") || null;
  if (!itemId) throw new Error("Missing item");

  const finding = await prisma.auditFindingItem.findUnique({
    where: { id: itemId },
    include: { audit: true },
  });
  if (!finding) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, finding.audit.organizationId);

  if (!["PASS", "FAIL", "NA", ""].includes(result)) throw new Error("Invalid result");

  await prisma.auditFindingItem.update({
    where: { id: itemId },
    data: {
      result: result === "" ? null : (result as "PASS" | "FAIL" | "NA"),
      notes,
    },
  });

  // Auto-update score on the parent audit (PASS / (PASS+FAIL))
  const items = await prisma.auditFindingItem.findMany({
    where: { auditId: finding.audit.id },
    select: { result: true },
  });
  const pass = items.filter((i) => i.result === "PASS").length;
  const fail = items.filter((i) => i.result === "FAIL").length;
  await prisma.audit.update({
    where: { id: finding.audit.id },
    data: {
      scoreNumerator: pass,
      scoreDenominator: pass + fail,
    },
  });

  revalidatePath(`/audits/${finding.audit.id}`);
}
