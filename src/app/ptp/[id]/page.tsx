import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  acknowledgePtp,
  deletePreTaskPlan,
  updatePreTaskPlan,
} from "@/lib/actions/ptp";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

export default async function PtpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const [ptp, sites] = await Promise.all([
    prisma.preTaskPlan.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, name: true } },
        acknowledgements: {
          orderBy: { acknowledgedAt: "asc" },
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!ptp || ptp.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";
  const canEdit = isAdmin || ptp.createdBy.id === session.user.id;
  const myAck = ptp.acknowledgements.find((a) => a.userId === session.user.id);

  return (
    <div className="space-y-6">
      <Link
        href="/ptp"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Pre-Task Plans
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{ptp.title}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {formatDate(ptp.date)} · {ptp.createdBy.name ?? ptp.createdBy.email}
            {ptp.site ? ` · ${ptp.site.name}` : ""}
          </p>
          <span
            className={cn(
              "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_STYLES[ptp.status],
            )}
          >
            {ptp.status}
          </span>
        </div>
        {canEdit ? (
          <form action={deletePreTaskPlan}>
            <input type="hidden" name="id" value={ptp.id} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Task
        </h2>
        <p className="whitespace-pre-wrap text-sm">{ptp.task}</p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Hazards
        </h2>
        <p className="whitespace-pre-wrap text-sm">{ptp.hazards}</p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Controls
        </h2>
        <p className="whitespace-pre-wrap text-sm">{ptp.controls}</p>
      </Card>

      {ptp.ppe ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            PPE
          </h2>
          <p className="whitespace-pre-wrap text-sm">{ptp.ppe}</p>
        </Card>
      ) : null}

      {ptp.emergencyInfo ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Emergency / muster
          </h2>
          <p className="whitespace-pre-wrap text-sm">{ptp.emergencyInfo}</p>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Acknowledgements ({ptp.acknowledgements.length})
          </h2>
          {myAck ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              You acknowledged on {formatDate(myAck.acknowledgedAt)}
            </span>
          ) : (
            <form action={acknowledgePtp}>
              <input type="hidden" name="id" value={ptp.id} />
              <Button type="submit" size="sm">
                I read & understood
              </Button>
            </form>
          )}
        </div>
        <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
          {ptp.acknowledgements.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>{a.user.name ?? a.user.email}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatDate(a.acknowledgedAt)}
              </span>
            </div>
          ))}
          {ptp.acknowledgements.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No acknowledgements yet.
            </div>
          ) : null}
        </div>
      </Card>

      {canEdit ? (
        <Card>
          <h2 className="mb-3 font-medium">Edit plan</h2>
          <form action={updatePreTaskPlan} className="space-y-3">
            <input type="hidden" name="id" value={ptp.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input name="title" required maxLength={200} defaultValue={ptp.title} />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  name="date"
                  type="date"
                  required
                  defaultValue={ptp.date.toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <Label>Site</Label>
                <Select name="siteId" defaultValue={ptp.siteId ?? ""}>
                  <option value="">— No site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={ptp.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Task</Label>
              <Textarea name="task" required maxLength={2000} defaultValue={ptp.task} />
            </div>
            <div>
              <Label>Hazards</Label>
              <Textarea name="hazards" required maxLength={20000} defaultValue={ptp.hazards} />
            </div>
            <div>
              <Label>Controls</Label>
              <Textarea name="controls" required maxLength={20000} defaultValue={ptp.controls} />
            </div>
            <div>
              <Label>PPE</Label>
              <Input name="ppe" maxLength={2000} defaultValue={ptp.ppe ?? ""} />
            </div>
            <div>
              <Label>Emergency info</Label>
              <Input
                name="emergencyInfo"
                maxLength={2000}
                defaultValue={ptp.emergencyInfo ?? ""}
              />
            </div>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
