"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import type { FormFieldType, FormStatus } from "@prisma/client";

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "CHECKBOXES",
  "SELECT",
] as const;

const formCreateSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
});

export async function createForm(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = formCreateSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { organizationId, name, description } = parsed.data;

  await assertOrgAccess(session.user.role, session.user.organizationId, organizationId);

  let createdId: string;
  try {
    const created = await prisma.form.create({
      data: {
        organizationId,
        name,
        description: description ?? null,
        createdById: session.user.id,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    throw new Error("A form with that name already exists");
  }

  revalidatePath("/admin/settings/forms");
  revalidatePath("/admin/forms");
  redirect(`/admin/forms/${createdId}`);
}

const formUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
});

export async function updateForm(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = formUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const form = await prisma.form.findUnique({ where: { id: parsed.data.id } });
  if (!form) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, form.organizationId);

  try {
    await prisma.form.update({
      where: { id: form.id },
      data: { name: parsed.data.name, description: parsed.data.description ?? null },
    });
  } catch {
    throw new Error("A form with that name already exists");
  }

  revalidatePath("/admin/settings/forms");
  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${form.id}`);
  revalidatePath("/forms");
}

export async function deleteForm(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, form.organizationId);

  await prisma.form.delete({ where: { id } });

  revalidatePath("/admin/settings/forms");
  revalidatePath("/admin/forms");
  revalidatePath("/forms");
}

export async function setFormStatus(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FormStatus;
  if (!id || (status !== "DRAFT" && status !== "PUBLISHED")) {
    throw new Error("Invalid input");
  }

  const form = await prisma.form.findUnique({
    where: { id },
    include: { _count: { select: { fields: true } } },
  });
  if (!form) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, form.organizationId);

  if (status === "PUBLISHED" && form._count.fields === 0) {
    throw new Error("Add at least one field before publishing");
  }

  await prisma.form.update({ where: { id }, data: { status } });

  revalidatePath("/admin/settings/forms");
  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${id}`);
  revalidatePath("/forms");
}

const fieldSchema = z.object({
  formId: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.string().max(2000).optional().nullable(),
  placeholder: z.string().max(200).optional().nullable(),
});

function parseOptions(input: string | null | undefined, type: FormFieldType): string | null {
  if (type !== "SELECT" && type !== "CHECKBOXES") return null;
  if (!input) throw new Error("Provide at least one option for this field");
  const opts = input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (opts.length === 0) throw new Error("Provide at least one option for this field");
  return JSON.stringify(opts);
}

export async function addFormField(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = fieldSchema.safeParse({
    formId: formData.get("formId"),
    label: formData.get("label"),
    type: formData.get("type"),
    required: formData.get("required") === "on",
    options: formData.get("options") || null,
    placeholder: formData.get("placeholder") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const form = await prisma.form.findUnique({ where: { id: parsed.data.formId } });
  if (!form) throw new Error("Form not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, form.organizationId);

  const optionsJson = parseOptions(parsed.data.options, parsed.data.type);

  const last = await prisma.formField.findFirst({
    where: { formId: form.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.formField.create({
    data: {
      formId: form.id,
      label: parsed.data.label,
      type: parsed.data.type,
      required: parsed.data.required,
      placeholder: parsed.data.placeholder ?? null,
      options: optionsJson,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/admin/forms/${form.id}`);
  revalidatePath("/forms");
}

export async function deleteFormField(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const field = await prisma.formField.findUnique({
    where: { id },
    include: { form: { select: { id: true, organizationId: true } } },
  });
  if (!field) throw new Error("Not found");
  await assertOrgAccess(
    session.user.role,
    session.user.organizationId,
    field.form.organizationId,
  );

  await prisma.formField.delete({ where: { id } });

  revalidatePath(`/admin/forms/${field.form.id}`);
  revalidatePath("/forms");
}

export async function submitForm(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const formId = String(formData.get("formId") ?? "");
  if (!formId) throw new Error("Missing formId");

  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!form) throw new Error("Form not found");
  if (form.organizationId !== session.user.organizationId) throw new Error("Forbidden");
  if (form.status !== "PUBLISHED") throw new Error("This form is not currently available");

  const values: Record<string, unknown> = {};
  for (const field of form.fields) {
    const raw = formData.get(`f_${field.id}`);
    let value: unknown = null;
    switch (field.type) {
      case "TEXT":
      case "TEXTAREA": {
        const s = raw == null ? "" : String(raw).trim();
        if (field.required && !s) throw new Error(`${field.label} is required`);
        value = s;
        break;
      }
      case "NUMBER": {
        if (raw == null || String(raw) === "") {
          if (field.required) throw new Error(`${field.label} is required`);
          value = null;
        } else {
          const n = Number(raw);
          if (Number.isNaN(n)) throw new Error(`${field.label} must be a number`);
          value = n;
        }
        break;
      }
      case "DATE": {
        const s = raw == null ? "" : String(raw);
        if (field.required && !s) throw new Error(`${field.label} is required`);
        value = s || null;
        break;
      }
      case "CHECKBOX": {
        value = raw === "on" || raw === "true";
        break;
      }
      case "SELECT": {
        const s = raw == null ? "" : String(raw);
        if (field.required && !s) throw new Error(`${field.label} is required`);
        if (s && field.options) {
          const opts: string[] = JSON.parse(field.options);
          if (!opts.includes(s)) throw new Error(`${field.label} has an invalid value`);
        }
        value = s || null;
        break;
      }
      case "CHECKBOXES": {
        const raws = formData.getAll(`f_${field.id}`).map((v) => String(v));
        if (field.required && raws.length === 0) {
          throw new Error(`${field.label} is required`);
        }
        if (field.options) {
          const opts: string[] = JSON.parse(field.options);
          for (const v of raws) {
            if (!opts.includes(v)) {
              throw new Error(`${field.label} has an invalid value`);
            }
          }
        }
        value = raws;
        break;
      }
    }
    values[field.id] = value;
  }

  await prisma.formSubmission.create({
    data: {
      formId: form.id,
      userId: session.user.id,
      values: values as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/forms/${form.id}`);
  revalidatePath(`/admin/forms/${form.id}`);
}
