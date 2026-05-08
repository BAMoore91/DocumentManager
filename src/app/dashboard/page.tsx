import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserDashboardContent } from "@/components/user-dashboard-content";

export default async function UserDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <UserDashboardContent
      userId={session.user.id}
      title="My Dashboard"
      subtitle="Your certificates and document expirations."
      uploadHref="/documents"
      complianceHeading="My compliance"
    />
  );
}
