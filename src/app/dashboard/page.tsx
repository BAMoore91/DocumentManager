import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserDashboardContent } from "@/components/user-dashboard-content";
import { NotificationsCard } from "@/components/notifications-card";

export default async function UserDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <NotificationsCard userId={session.user.id} />
      <UserDashboardContent
        userId={session.user.id}
        title="My Dashboard"
        subtitle="Your certificates and document expirations."
        uploadHref="/documents"
        complianceHeading="My compliance"
      />
    </div>
  );
}
