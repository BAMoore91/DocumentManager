import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const submittedValues = (body?.values ?? {}) as Record<string, unknown>;

  const form = await prisma.form.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  if (form.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (form.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "This form is not currently available" },
      { status: 400 },
    );
  }

  const values: Record<string, unknown> = {};
  for (const field of form.fields) {
    const raw = submittedValues[field.id];
    let value: unknown = null;
    switch (field.type) {
      case "TEXT":
      case "TEXTAREA": {
        const s = typeof raw === "string" ? raw.trim() : "";
        if (field.required && !s) {
          return NextResponse.json(
            { error: `${field.label} is required` },
            { status: 400 },
          );
        }
        value = s;
        break;
      }
      case "NUMBER": {
        if (raw === null || raw === undefined || raw === "") {
          if (field.required) {
            return NextResponse.json(
              { error: `${field.label} is required` },
              { status: 400 },
            );
          }
          value = null;
        } else {
          const n = typeof raw === "number" ? raw : Number(raw);
          if (Number.isNaN(n)) {
            return NextResponse.json(
              { error: `${field.label} must be a number` },
              { status: 400 },
            );
          }
          value = n;
        }
        break;
      }
      case "DATE": {
        const s = typeof raw === "string" ? raw : "";
        if (field.required && !s) {
          return NextResponse.json(
            { error: `${field.label} is required` },
            { status: 400 },
          );
        }
        value = s || null;
        break;
      }
      case "CHECKBOX": {
        value = !!raw;
        break;
      }
      case "SELECT": {
        const s = typeof raw === "string" ? raw : "";
        if (field.required && !s) {
          return NextResponse.json(
            { error: `${field.label} is required` },
            { status: 400 },
          );
        }
        if (s && field.options) {
          const opts: string[] = JSON.parse(field.options);
          if (!opts.includes(s)) {
            return NextResponse.json(
              { error: `${field.label} has an invalid value` },
              { status: 400 },
            );
          }
        }
        value = s || null;
        break;
      }
      case "CHECKBOXES": {
        const raws = Array.isArray(raw)
          ? raw.filter((v) => v !== null && v !== undefined).map((v) => String(v))
          : [];
        if (field.required && raws.length === 0) {
          return NextResponse.json(
            { error: `${field.label} is required` },
            { status: 400 },
          );
        }
        if (field.options) {
          const opts: string[] = JSON.parse(field.options);
          for (const v of raws) {
            if (!opts.includes(v)) {
              return NextResponse.json(
                { error: `${field.label} has an invalid value` },
                { status: 400 },
              );
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

  await recordAction({
    organizationId: form.organizationId,
    userId: session.user.id,
    action: "form.submit",
    summary: `Submitted form "${form.name}"`,
    entityType: "Form",
    entityId: form.id,
    metadata: { source: "api" },
  });

  return NextResponse.json({ ok: true });
}
