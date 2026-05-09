"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole, requireAuth } from "@/lib/auth";

const MAX_BYTES = 15 * 1024 * 1024;

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function validateOrgRoles(orgId: string, roleIds: string[]) {
  if (roleIds.length === 0) return [];
  const found = await prisma.customRole.findMany({
    where: { id: { in: roleIds }, organizationId: orgId },
    select: { id: true },
  });
  if (found.length !== roleIds.length) throw new Error("Invalid role assignment");
  return found.map((r) => r.id);
}

const courseSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  defaultValidityDays: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }, z.number().int().min(0).max(36500).nullable()),
});

export async function createTrainingCourse(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = courseSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    defaultValidityDays: formData.get("defaultValidityDays"),
  });
  if (!parsed.success) throw new Error("Course name is required");

  await assertOrgAccess(session.user.role, session.user.organizationId, parsed.data.organizationId);

  const roleIds = formData.getAll("customRoleIds").map((v) => String(v)).filter(Boolean);
  const validRoleIds = await validateOrgRoles(parsed.data.organizationId, roleIds);

  try {
    await prisma.trainingCourse.create({
      data: {
        organizationId: parsed.data.organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        defaultValidityDays: parsed.data.defaultValidityDays,
        customRoles: { connect: validRoleIds.map((id) => ({ id })) },
      },
    });
  } catch {
    throw new Error("A course with that name already exists");
  }

  revalidatePath("/admin/settings/training");
  revalidatePath("/training");
  revalidatePath("/dashboard");
}

export async function updateTrainingCourse(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const course = await prisma.trainingCourse.findUnique({ where: { id } });
  if (!course) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, course.organizationId);

  const parsed = courseSchema.safeParse({
    organizationId: course.organizationId,
    name: formData.get("name"),
    description: formData.get("description") || null,
    defaultValidityDays: formData.get("defaultValidityDays"),
  });
  if (!parsed.success) throw new Error("Course name is required");

  const roleIds = formData.getAll("customRoleIds").map((v) => String(v)).filter(Boolean);
  const validRoleIds = await validateOrgRoles(course.organizationId, roleIds);

  try {
    await prisma.trainingCourse.update({
      where: { id: course.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        defaultValidityDays: parsed.data.defaultValidityDays,
        customRoles: { set: validRoleIds.map((rid) => ({ id: rid })) },
      },
    });
  } catch {
    throw new Error("A course with that name already exists");
  }

  revalidatePath("/admin/settings/training");
  revalidatePath("/training");
  revalidatePath("/dashboard");
}

export async function deleteTrainingCourse(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const course = await prisma.trainingCourse.findUnique({ where: { id } });
  if (!course) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, course.organizationId);

  await prisma.trainingCourse.delete({ where: { id } });
  revalidatePath("/admin/settings/training");
  revalidatePath("/training");
  revalidatePath("/dashboard");
}

const recordSchema = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
  completedAt: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
  instructor: z.string().max(120).optional().nullable(),
  provider: z.string().max(120).optional().nullable(),
  hours: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }, z.number().min(0).max(9999).nullable()),
  notes: z.string().max(2000).optional().nullable(),
});

async function uploadCertificate(file: File, organizationId: string) {
  if (file.size > MAX_BYTES) throw new Error("Certificate exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(
    `training/${organizationId}/${Date.now()}-${safeName}`,
    file,
    {
      access: "public",
      contentType: file.type || "application/octet-stream",
    },
  );
  return {
    certificateUrl: blob.url,
    certificateName: file.name,
    certificateSize: file.size,
  };
}

export async function createTrainingRecord(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");

  const parsed = recordSchema.safeParse({
    userId: formData.get("userId"),
    courseId: formData.get("courseId"),
    completedAt: formData.get("completedAt"),
    expiresAt: formData.get("expiresAt") || null,
    instructor: formData.get("instructor") || null,
    provider: formData.get("provider") || null,
    hours: formData.get("hours"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("User, course, and completion date are required");

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.userId } }),
    prisma.trainingCourse.findUnique({ where: { id: parsed.data.courseId } }),
  ]);
  if (!user || user.organizationId !== session.user.organizationId) throw new Error("Invalid user");
  if (!course || course.organizationId !== session.user.organizationId) throw new Error("Invalid course");

  let expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (!expiresAt && course.defaultValidityDays && course.defaultValidityDays > 0) {
    expiresAt = new Date(parsed.data.completedAt);
    expiresAt.setDate(expiresAt.getDate() + course.defaultValidityDays);
  }

  let certFields = {} as {
    certificateUrl?: string;
    certificateName?: string;
    certificateSize?: number;
  };
  const file = formData.get("certificate") as File | null;
  if (file && file.size > 0) {
    certFields = await uploadCertificate(file, session.user.organizationId);
  }

  await prisma.trainingRecord.create({
    data: {
      organizationId: session.user.organizationId,
      userId: parsed.data.userId,
      courseId: parsed.data.courseId,
      completedAt: new Date(parsed.data.completedAt),
      expiresAt,
      instructor: parsed.data.instructor ?? null,
      provider: parsed.data.provider ?? null,
      hours: parsed.data.hours,
      notes: parsed.data.notes ?? null,
      recordedById: session.user.id,
      ...certFields,
    },
  });

  revalidatePath("/training");
  revalidatePath("/dashboard");
}

export async function deleteTrainingRecord(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const record = await prisma.trainingRecord.findUnique({ where: { id } });
  if (!record) throw new Error("Not found");
  if (record.organizationId !== session.user.organizationId) throw new Error("Forbidden");
  if (session.user.role !== "ORG_ADMIN") throw new Error("Forbidden");

  if (record.certificateUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(record.certificateUrl);
    } catch {
      // ignore
    }
  }

  await prisma.trainingRecord.delete({ where: { id } });
  revalidatePath("/training");
  revalidatePath("/dashboard");
}
