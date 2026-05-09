import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { IncidentTypeBadge, IncidentStatusBadge } from "@/components/incident-badges";
import { PrintButton } from "@/components/print-button";
import {
  addIncidentPhotos,
  deleteIncident,
  removeIncidentPhoto,
  setIncidentStatus,
  updateIncident,
} from "@/lib/actions/incidents";
import { formatDate } from "@/lib/utils";

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const [incident, members] = await Promise.all([
    prisma.incident.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        personInvolved: { select: { id: true, name: true, email: true } },
        photos: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!incident || incident.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";
  const canEdit = isAdmin || incident.reportedBy.id === session.user.id;

  return (
    <div className="space-y-6">
      <Link
        href="/incidents"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {incident.personName}
            {incident.caseNumber ? (
              <span className="ml-2 text-base font-normal text-[hsl(var(--muted-foreground))]">
                Case #{incident.caseNumber}
              </span>
            ) : null}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <IncidentTypeBadge type={incident.type} />
            <IncidentStatusBadge status={incident.status} />
          </div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Occurred {formatDate(incident.occurredAt)}
            {incident.location ? ` · ${incident.location}` : ""} · Reported by{" "}
            {incident.reportedBy.name ?? incident.reportedBy.email}
            {incident.closedAt ? ` · Closed ${formatDate(incident.closedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton />
          {isAdmin ? (
            <form action={setIncidentStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={incident.id} />
              <Select
                name="status"
                defaultValue={incident.status}
                className="h-8 w-auto text-xs"
              >
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="CLOSED">Closed</option>
              </Select>
              <Button type="submit" variant="secondary" size="sm">
                Update status
              </Button>
            </form>
          ) : null}
          {canEdit ? (
            <form action={deleteIncident}>
              <input type="hidden" name="id" value={incident.id} />
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          What happened
        </h2>
        <p className="whitespace-pre-wrap text-sm">{incident.description}</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Person involved
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Name</dt>
            <dd>{incident.personName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Member</dt>
            <dd>
              {incident.personInvolved
                ? incident.personInvolved.name ?? incident.personInvolved.email
                : "External / non-member"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Job title</dt>
            <dd>{incident.jobTitle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Body part</dt>
            <dd>{incident.bodyPart ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Injury / illness</dt>
            <dd>{incident.injuryType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Treatment</dt>
            <dd className="whitespace-pre-wrap">{incident.treatmentReceived ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          OSHA classification
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Days away</dt>
            <dd className="tabular-nums">{incident.daysAway ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Days restricted</dt>
            <dd className="tabular-nums">{incident.daysRestricted ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Type</dt>
            <dd>
              <IncidentTypeBadge type={incident.type} />
            </dd>
          </div>
        </dl>
      </Card>

      {incident.rootCause || incident.correctiveActions ? (
        <Card>
          <h2 className="mb-3 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Investigation
          </h2>
          {incident.rootCause ? (
            <div className="mb-3">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Root cause</div>
              <p className="whitespace-pre-wrap text-sm">{incident.rootCause}</p>
            </div>
          ) : null}
          {incident.correctiveActions ? (
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Corrective actions
              </div>
              <p className="whitespace-pre-wrap text-sm">{incident.correctiveActions}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {incident.photos.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Photos ({incident.photos.length})
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {incident.photos.map((p) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-md border border-[hsl(var(--border))]"
              >
                <Link href={p.fileUrl} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.fileUrl}
                    alt={p.caption ?? p.fileName}
                    className="aspect-square w-full object-cover"
                  />
                </Link>
                {canEdit ? (
                  <form
                    action={removeIncidentPhoto}
                    className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <Card className="print:hidden">
          <h2 className="mb-3 font-medium">Add more photos</h2>
          <form
            action={addIncidentPhotos}
            encType="multipart/form-data"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="id" value={incident.id} />
            <div className="flex-1">
              <Label htmlFor="more-photos">Choose images (max 15 MB each)</Label>
              <Input
                id="more-photos"
                name="photos"
                type="file"
                accept="image/*"
                multiple
                required
              />
            </div>
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </form>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="print:hidden">
          <h2 className="mb-3 font-medium">Edit report</h2>
          <form action={updateIncident} className="space-y-3">
            <input type="hidden" name="id" value={incident.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select id="edit-type" name="type" required defaultValue={incident.type}>
                  <option value="NEAR_MISS">Near miss (no injury)</option>
                  <option value="FIRST_AID">First aid only</option>
                  <option value="RECORDABLE">Recordable injury / illness</option>
                  <option value="RESTRICTED_DUTY">Restricted duty</option>
                  <option value="LOST_TIME">Lost time</option>
                  <option value="FATALITY">Fatality</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-occurredAt">When</Label>
                <Input
                  id="edit-occurredAt"
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={isoLocal(incident.occurredAt)}
                />
              </div>
              <div>
                <Label htmlFor="edit-caseNumber">Case #</Label>
                <Input
                  id="edit-caseNumber"
                  name="caseNumber"
                  maxLength={60}
                  defaultValue={incident.caseNumber ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  name="location"
                  maxLength={200}
                  defaultValue={incident.location ?? ""}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                required
                maxLength={20000}
                defaultValue={incident.description}
                className="min-h-[120px]"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-personName">Person name</Label>
                <Input
                  id="edit-personName"
                  name="personName"
                  required
                  maxLength={200}
                  defaultValue={incident.personName}
                />
              </div>
              <div>
                <Label htmlFor="edit-personUserId">Member</Label>
                <Select
                  id="edit-personUserId"
                  name="personUserId"
                  defaultValue={incident.personUserId ?? ""}
                >
                  <option value="">— Not a member / external —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-jobTitle">Job title</Label>
                <Input
                  id="edit-jobTitle"
                  name="jobTitle"
                  maxLength={120}
                  defaultValue={incident.jobTitle ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-bodyPart">Body part</Label>
                <Input
                  id="edit-bodyPart"
                  name="bodyPart"
                  maxLength={120}
                  defaultValue={incident.bodyPart ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-injuryType">Injury / illness</Label>
                <Input
                  id="edit-injuryType"
                  name="injuryType"
                  maxLength={120}
                  defaultValue={incident.injuryType ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-treatmentReceived">Treatment</Label>
                <Input
                  id="edit-treatmentReceived"
                  name="treatmentReceived"
                  maxLength={2000}
                  defaultValue={incident.treatmentReceived ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-daysAway">Days away</Label>
                <Input
                  id="edit-daysAway"
                  name="daysAway"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={incident.daysAway ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-daysRestricted">Days restricted</Label>
                <Input
                  id="edit-daysRestricted"
                  name="daysRestricted"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={incident.daysRestricted ?? ""}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-rootCause">Root cause</Label>
              <Textarea
                id="edit-rootCause"
                name="rootCause"
                maxLength={5000}
                defaultValue={incident.rootCause ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="edit-correctiveActions">Corrective actions</Label>
              <Textarea
                id="edit-correctiveActions"
                name="correctiveActions"
                maxLength={5000}
                defaultValue={incident.correctiveActions ?? ""}
              />
            </div>
            <SubmitButton variant="secondary" pendingLabel="Saving…">
              Save changes
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
