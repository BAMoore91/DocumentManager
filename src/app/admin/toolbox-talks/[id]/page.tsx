import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addAttendee, removeAttendee } from "@/lib/actions/toolbox-talks";
import { formatDate } from "@/lib/utils";

export default async function ToolboxTalkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const talk = await prisma.toolboxTalk.findUnique({
    where: { id },
    include: {
      presenter: { select: { name: true, email: true, customRole: { select: { name: true } } } },
      attendances: {
        orderBy: { attendedAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              customRole: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!talk || talk.organizationId !== orgId) notFound();

  const attendingIds = new Set(talk.attendances.map((a) => a.userId));
  const candidates = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      id: { notIn: Array.from(attendingIds) },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      customRole: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/toolbox-talks"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← All toolbox talks
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

      {talk.notes ? (
        <Card>
          <h2 className="mb-2 font-medium">Talking points</h2>
          <p className="whitespace-pre-wrap text-sm">{talk.notes}</p>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Attendance{" "}
            <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">
              ({talk.attendances.length})
            </span>
          </h2>
        </div>

        {candidates.length > 0 ? (
          <form action={addAttendee} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="talkId" value={talk.id} />
            <div className="flex-1">
              <Label>Add attendee</Label>
              <Select name="userId" required>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name ?? u.email) +
                      (u.customRole?.name ? ` — ${u.customRole.name}` : "")}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Add</Button>
          </form>
        ) : (
          <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
            Everyone in the organization is already on the attendance list.
          </p>
        )}

        <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
          {talk.attendances.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{a.user.name ?? a.user.email}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {a.user.email}
                  {a.user.customRole?.name ? ` · ${a.user.customRole.name}` : ""}
                </div>
              </div>
              <form action={removeAttendee}>
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="danger" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          ))}
          {talk.attendances.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No attendees recorded yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
