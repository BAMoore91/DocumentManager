import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/super-admin");
  if (session.user.role !== "ORG_ADMIN") redirect("/dashboard");

  const org = session.user.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
      })
    : null;

  return (
    <AppShell role={session.user.role} email={session.user.email ?? ""} orgName={org?.name}>
      {children}
    </AppShell>
  );
}
