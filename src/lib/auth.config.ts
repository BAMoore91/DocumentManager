import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
        token.organizationId = (user as { organizationId: string | null }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.organizationId = (token.organizationId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const PUBLIC = ["/login", "/api/auth"];
      if (PUBLIC.some((p) => pathname.startsWith(p))) return true;
      if (!auth?.user) return false;

      const role = auth.user.role;
      if (pathname.startsWith("/super-admin")) return role === "SUPER_ADMIN";
      if (pathname.startsWith("/admin")) return role === "ORG_ADMIN";
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/documents")) return role === "USER";
      return true;
    },
  },
} satisfies NextAuthConfig;
