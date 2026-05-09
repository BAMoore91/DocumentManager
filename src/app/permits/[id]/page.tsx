import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  acknowledgePermit,
  deletePermit,
  setPermitStatus,
} from "@/lib/actions/permits";
import { PrintButton } from "@/components/print-button";
import { SignaturePad } from "@/components/signature-pad";
import { cn, formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  HOT_WORK: "Hot work",
  CONFINED_SPACE: "Confined space",
  LOCKOUT_TAGOUT: "Lockout / tagout",
  WORKING_AT_HEIGHTS: "Working at heights",
  ELECTRICAL: "Electrical",
  EXCAVATION: "Excavation",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  ISSUED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  CLOSED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

export default async function PermitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ORG_ADMIN";
  const { id } = await params;

  const [permit, signatures] = await Promise.all([
    prisma.permit.findUnique({
      where: { id },
      include: {
        issuedBy: { select: { name: true, email: true } },
        recipient: { select: { name: true, email: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.signature.findMany({
      where: { contextType: "PERMIT_RECIPIENT", contextId: id },
      orderBy: { signedAt: "asc" },
      select: { id: true, signerName: true, imageDataUrl: true, signedAt: true },
    }),
  ]);
  if (!permit || permit.organizationId !== orgId) notFound();
  const mySigned = signatures.some((s) => s.signerName.toLowerCase() === (session.user.name ?? session.user.email ?? "").toLowerCase());

  return (
    <div className="space-y-6">
      <Link
        href="/permits"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Permits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{permit.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              {TYPE_LABELS[permit.type] ?? permit.type}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_STYLES[permit.status],
              )}
            >
              {permit.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Issued by {permit.issuedBy.name ?? permit.issuedBy.email} ·{" "}
            Valid {formatDate(permit.validFrom)} – {formatDate(permit.validUntil)}
            {permit.site ? ` · ${permit.site.name}` : ""}
            {permit.location ? ` · ${permit.location}` : ""}
            {permit.closedAt ? ` · Closed ${formatDate(permit.closedAt)}` : ""}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Recipient:{" "}
            {permit.recipient
              ? permit.recipient.name ?? permit.recipient.email
              : permit.recipientName ?? "External / non-member"}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <PrintButton />
          {isAdmin ? (
            <form action={deletePermit}>
              <input type="hidden" name="id" value={permit.id} />
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {permit.description ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Work to be performed
          </h2>
          <p className="whitespace-pre-wrap text-sm">{permit.description}</p>
        </Card>
      ) : null}

      {permit.hazards ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Hazards
          </h2>
          <p className="whitespace-pre-wrap text-sm">{permit.hazards}</p>
        </Card>
      ) : null}

      {permit.controls ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Controls
          </h2>
          <p className="whitespace-pre-wrap text-sm">{permit.controls}</p>
        </Card>
      ) : null}

      {permit.closedNotes ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Closeout notes
          </h2>
          <p className="whitespace-pre-wrap text-sm">{permit.closedNotes}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-medium">Signatures ({signatures.length})</h2>
        <div className="space-y-2">
          {signatures.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{s.signerName}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatDate(s.signedAt)}
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageDataUrl}
                alt={`signature by ${s.signerName}`}
                className="h-10 rounded border border-[hsl(var(--border))] bg-white"
              />
            </div>
          ))}
          {signatures.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No signatures captured yet.
            </p>
          ) : null}
        </div>

        {permit.status === "ISSUED" && !mySigned ? (
          <form action={acknowledgePermit} className="mt-4 space-y-3 print:hidden">
            <input type="hidden" name="id" value={permit.id} />
            <div>
              <Label>Sign as recipient / acknowledger</Label>
              <SignaturePad fieldName="signature" required />
            </div>
            <Button type="submit" size="sm">
              Submit signature
            </Button>
          </form>
        ) : null}
      </Card>

      {isAdmin ? (
        <Card className="print:hidden">
          <h2 className="mb-3 font-medium">Update status</h2>
          <form action={setPermitStatus} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={permit.id} />
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={permit.status}>
                <option value="ISSUED">Issued</option>
                <option value="EXPIRED">Expired</option>
                <option value="CLOSED">Closed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="closedNotes">Closeout notes (when closing)</Label>
              <Input id="closedNotes" name="closedNotes" maxLength={2000} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary" size="sm">
                Save
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
