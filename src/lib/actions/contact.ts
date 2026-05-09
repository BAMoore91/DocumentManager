"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  businessName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(400),
  phone: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200),
  userCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number().int().min(1).max(100000),
  ),
  industry: z.string().trim().min(1).max(100),
  message: z.string().max(5000).optional().nullable(),
});

export async function submitContact(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    businessName: formData.get("businessName"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    userCount: formData.get("userCount"),
    industry: formData.get("industry"),
    message: formData.get("message") || null,
  });
  if (!parsed.success) {
    redirect("/?contact=error");
  }

  await prisma.contactSubmission.create({
    data: {
      name: parsed.data.name,
      businessName: parsed.data.businessName,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      userCount: parsed.data.userCount,
      industry: parsed.data.industry,
      message: parsed.data.message ?? null,
    },
  });

  const notifyTo = process.env.CONTACT_EMAIL_TO;
  if (notifyTo) {
    const lines = [
      `New contact request from ${parsed.data.name} (${parsed.data.businessName})`,
      "",
      `Name:           ${parsed.data.name}`,
      `Business:       ${parsed.data.businessName}`,
      `Industry:       ${parsed.data.industry}`,
      `User count:     ${parsed.data.userCount}`,
      `Email:          ${parsed.data.email}`,
      `Phone:          ${parsed.data.phone}`,
      `Address:        ${parsed.data.address}`,
      parsed.data.message ? `\nMessage:\n${parsed.data.message}` : "",
    ];
    await sendEmail({
      to: notifyTo,
      subject: `Contact request: ${parsed.data.businessName}`,
      text: lines.join("\n"),
    });
  }

  redirect("/?contact=success#contact");
}

export async function deleteContactSubmission(formData: FormData): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.contactSubmission.delete({ where: { id } }).catch(() => {});
  revalidatePath("/super-admin/contact-submissions");
  revalidatePath("/super-admin");
}
