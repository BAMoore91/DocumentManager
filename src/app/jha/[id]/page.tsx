import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { SeverityBadge, JhaStatusBadge } from "@/components/jha-badges";
import { PrintButton } from "@/components/print-button";
import {
  addJhaPhotos,
  deleteJhaReport,
  removeJhaPhoto,
  setJhaStatus,
  updateJhaReport,
} from "@/lib/actions/jha";
import { formatDate } from "@/lib/utils";

export default async function JhaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const report = await prisma.jhaReport.findUnique({
    where: { id },
    include: {
      reportedBy: { select: { id: true, name: true, email: true } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!report || report.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";
  const canEdit = isAdmin || report.reportedBy.id === session.user.id;

  return (
    <div className="space-y-6">
      <Link
        href="/jha"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Hazard reports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{report.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={report.severity} />
            <JhaStatusBadge status={report.status} />
          </div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {report.location ? `${report.location} · ` : ""}
            Reported by {report.reportedBy.name ?? report.reportedBy.email} ·{" "}
            {formatDate(report.createdAt)}
            {report.resolvedAt ? ` · Resolved ${formatDate(report.resolvedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton />
          {isAdmin ? (
            <form action={setJhaStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={report.id} />
              <Select
                name="status"
                defaultValue={report.status}
                className="h-8 w-auto text-xs"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
              </Select>
              <Button type="submit" variant="secondary" size="sm">
                Update status
              </Button>
            </form>
          ) : null}
          {canEdit ? (
            <form action={deleteJhaReport}>
              <input type="hidden" name="id" value={report.id} />
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
          Hazard
        </h2>
        <p className="whitespace-pre-wrap text-sm">{report.hazardDescription}</p>
        {report.mitigation ? (
          <>
            <h2 className="mb-2 mt-4 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
              Mitigation
            </h2>
            <p className="whitespace-pre-wrap text-sm">{report.mitigation}</p>
          </>
        ) : null}
      </Card>

      {report.photos.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Photos ({report.photos.length})
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {report.photos.map((p) => (
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
                    action={removeJhaPhoto}
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
        <Card>
          <h2 className="mb-3 font-medium">Add more photos</h2>
          <form
            action={addJhaPhotos}
            encType="multipart/form-data"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="id" value={report.id} />
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
        <Card>
          <h2 className="mb-3 font-medium">Edit report</h2>
          <form action={updateJhaReport} className="space-y-3">
            <input type="hidden" name="id" value={report.id} />
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                name="title"
                required
                maxLength={200}
                defaultValue={report.title}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  name="location"
                  maxLength={200}
                  defaultValue={report.location ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-severity">Severity</Label>
                <Select id="edit-severity" name="severity" required defaultValue={report.severity}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Hazard description</Label>
              <Textarea
                id="edit-description"
                name="hazardDescription"
                required
                maxLength={10000}
                defaultValue={report.hazardDescription}
                className="min-h-[120px]"
              />
            </div>
            <div>
              <Label htmlFor="edit-mitigation">Mitigation</Label>
              <Textarea
                id="edit-mitigation"
                name="mitigation"
                maxLength={10000}
                defaultValue={report.mitigation ?? ""}
                className="min-h-[80px]"
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
