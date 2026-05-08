import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpirationCalendar } from "@/components/expiration-calendar";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const { m } = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Document expirations across your organization. Click a document to open it.
        </p>
      </div>
      <ExpirationCalendar
        orgId={session.user.organizationId}
        monthParam={m}
        basePath="/admin/calendar"
      />
    </div>
  );
}
