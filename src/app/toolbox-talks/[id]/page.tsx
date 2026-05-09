import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

export default async function UserToolboxTalkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const userId = session.user.id;
  const { id } = await params;

  const talk = await prisma.toolboxTalk.findUnique({
    where: { id },
    include: {
      presenter: {
        select: { name: true, email: true, customRole: { select: { name: true } } },
      },
      attendances: { where: { userId }, take: 1 },
      assignedRoles: { select: { id: true, users: { select: { id: true } } } },
      assignedUsers: { select: { id: true } },
    },
  });
  if (!talk || talk.organizationId !== orgId) notFound();

  const myAttendance = talk.attendances[0] ?? null;

  const assigned =
    talk.assignedUsers.some((u) => u.id === userId) ||
    talk.assignedRoles.some((r) => r.users.some((u) => u.id === userId));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{talk.topic}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {formatDate(talk.date)} · Presented by{" "}
          {talk.presenter.name ?? talk.presenter.email}
          {talk.presenter.customRole?.name ? ` (${talk.presenter.customRole.name})` : ""}
          {talk.location ? ` · ${talk.location}` : ""}
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              assigned
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
            )}
          >
            {assigned ? "Assigned to you" : "Not assigned"}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              myAttendance
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
            )}
          >
            {myAttendance
              ? `Attended ${formatDate(myAttendance.attendedAt)}`
              : "Not yet attended"}
          </span>
        </div>
      </Card>

      {talk.notes ? (
        <Card>
          <h2 className="mb-2 font-medium">Talking points</h2>
          <p className="whitespace-pre-wrap text-sm">{talk.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
