import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { recordAction } from "@/lib/audit-log";
import type { Role } from "@prisma/client";

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.archivedAt) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, organizationId: true },
      });
      if (!u?.organizationId) return;
      await recordAction({
        organizationId: u.organizationId,
        userId: u.id,
        action: "user.login",
        summary: `${u.name ?? u.email} signed in`,
        entityType: "User",
        entityId: u.id,
      });
    },
    async signOut(message) {
      const userId =
        "token" in message && message.token?.sub
          ? String(message.token.sub)
          : null;
      if (!userId) return;
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, organizationId: true },
      });
      if (!u?.organizationId) return;
      await recordAction({
        organizationId: u.organizationId,
        userId: u.id,
        action: "user.logout",
        summary: `${u.name ?? u.email} signed out`,
        entityType: "User",
        entityId: u.id,
      });
    },
  },
});

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) throw new Error("FORBIDDEN");
  return session;
}
