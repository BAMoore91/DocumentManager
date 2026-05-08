import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrgDashboard } from "@/components/org-dashboard";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");

  return (
    <OrgDashboard
      orgId={session.user.organizationId}
      subtitle="Metrics for your organization's documents and members."
    />
  );
}
