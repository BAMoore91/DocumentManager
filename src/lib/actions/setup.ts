"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const setupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(72),
});

export async function isSetupComplete() {
  const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  return count > 0;
}

export async function createFirstAdmin(formData: FormData): Promise<void> {
  if (await isSetupComplete()) {
    throw new Error("Setup is already complete");
  }

  const parsed = setupSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    throw new Error("Invalid input — email, name, and 8+ char password required");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  redirect("/login?setup=complete");
}
