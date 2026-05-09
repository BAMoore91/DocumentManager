import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CapaPriorityBadge, CapaStatusBadge } from "@/components/capa-badges";
import {
  deleteCorrectiveAction,
  setCorrectiveActionStatus,
  updateCorrectiveAction,
} from "@/lib/actions/corrective-actions";
import { formatDate } from "@/lib/utils";

function dateInputValue(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function CapaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const [capa, members] = await Promise.all([
    prisma.correctiveAction.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!capa || capa.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";
  const canEdit = isAdmin || capa.createdBy.id === session.user.id;
  const canChangeStatus = isAdmin || capa.assignedTo?.id === session.user.id || canEdit;

  return (
    <div className="space-y-6">
      <Link
        href="/corrective-actions"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Corrective actions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{capa.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CapaStatusBadge status={capa.status} />
            <CapaPriorityBadge priority={capa.priority} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {capa.sourceType.replace(/_/g, " ")}
              {capa.sourceId ? ` · ref ${capa.sourceId}` : ""}
            </span>
          </div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Created by {capa.createdBy.name ?? capa.createdBy.email} ·{" "}
            {formatDate(capa.createdAt)}
            {capa.dueDate ? ` · due ${formatDate(capa.dueDate)}` : ""}
            {capa.closedAt ? ` · closed ${formatDate(capa.closedAt)}` : ""}
          </p>
        </div>
        {canEdit ? (
          <form action={deleteCorrectiveAction}>
            <input type="hidden" name="id" value={capa.id} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      {capa.description ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm">{capa.description}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Assigned to
        </h2>
        <p className="text-sm">
          {capa.assignedTo ? capa.assignedTo.name ?? capa.assignedTo.email : "Unassigned"}
        </p>
      </Card>

      {capa.verifiedAt ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Verification
          </h2>
          <p className="text-sm">
            Verified by {capa.verifiedBy?.name ?? capa.verifiedBy?.email ?? "—"} on{" "}
            {formatDate(capa.verifiedAt)}
          </p>
          {capa.verificationNotes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{capa.verificationNotes}</p>
          ) : null}
        </Card>
      ) : null}

      {canChangeStatus ? (
        <Card>
          <h2 className="mb-3 font-medium">Update status</h2>
          <form action={setCorrectiveActionStatus} className="space-y-3">
            <input type="hidden" name="id" value={capa.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={capa.status}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  {isAdmin ? <option value="VERIFIED">Verified</option> : null}
                  {isAdmin ? <option value="CLOSED">Closed</option> : null}
                </Select>
              </div>
              {isAdmin ? (
                <div>
                  <Label htmlFor="verificationNotes">Verification notes (optional)</Label>
                  <Input
                    id="verificationNotes"
                    name="verificationNotes"
                    maxLength={2000}
                    defaultValue={capa.verificationNotes ?? ""}
                  />
                </div>
              ) : null}
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Save status
            </Button>
          </form>
        </Card>
      ) : null}

      {canEdit ? (
        <Card>
          <h2 className="mb-3 font-medium">Edit</h2>
          <form action={updateCorrectiveAction} className="space-y-3">
            <input type="hidden" name="id" value={capa.id} />
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                name="title"
                required
                maxLength={200}
                defaultValue={capa.title}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                maxLength={5000}
                defaultValue={capa.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-sourceType">Source</Label>
                <Select id="edit-sourceType" name="sourceType" required defaultValue={capa.sourceType}>
                  <option value="JHA">JHA / Hazard report</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="AUDIT">Audit / inspection</option>
                  <option value="OBSERVATION">Observation</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-sourceId">Source reference</Label>
                <Input
                  id="edit-sourceId"
                  name="sourceId"
                  maxLength={60}
                  defaultValue={capa.sourceId ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select id="edit-priority" name="priority" required defaultValue={capa.priority}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-dueDate">Due date</Label>
                <Input
                  id="edit-dueDate"
                  name="dueDate"
                  type="date"
                  defaultValue={dateInputValue(capa.dueDate)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-assignedToId">Assigned to</Label>
                <Select
                  id="edit-assignedToId"
                  name="assignedToId"
                  defaultValue={capa.assignedToId ?? ""}
                >
                  <option value="">— Unassigned —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" variant="secondary">
              Save changes
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
