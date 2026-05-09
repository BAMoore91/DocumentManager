import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrgDashboard } from "@/components/org-dashboard";
import { NotificationsCard } from "@/components/notifications-card";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");

  return (
    <div className="space-y-6">
      <NotificationsCard userId={session.user.id} />
      <OrgDashboard
        orgId={session.user.organizationId}
        subtitle="Metrics for your organization's documents and members."
        userLinkBasePath="/admin/users"
      />
    </div>
  );
}
