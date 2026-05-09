import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { deleteSdsSheet, updateSdsSheet } from "@/lib/actions/sds";
import { formatBytes, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

function dateInputValue(d: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function SdsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const sheet = await prisma.sdsSheet.findUnique({
    where: { id },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });
  if (!sheet || sheet.organizationId !== orgId) notFound();

  const isAdmin = session.user.role === "ORG_ADMIN";

  return (
    <div className="space-y-6">
      <Link
        href="/sds"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Safety Data Sheets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{sheet.productName}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {sheet.manufacturer ? `${sheet.manufacturer} · ` : ""}
            {sheet.casNumber ? `CAS ${sheet.casNumber} · ` : ""}
            Uploaded by {sheet.uploadedBy.name ?? sheet.uploadedBy.email} ·{" "}
            {formatDate(sheet.createdAt)}
            {sheet.revisionDate ? ` · Revision ${formatDate(sheet.revisionDate)}` : ""}
          </p>
        </div>
        {isAdmin ? (
          <form action={deleteSdsSheet}>
            <input type="hidden" name="id" value={sheet.id} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <Link
              href={sheet.fileUrl}
              target="_blank"
              className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
            >
              {sheet.fileName}
            </Link>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {formatBytes(sheet.fileSize)}
            </span>
          </div>
          <Link
            href={sheet.fileUrl}
            target="_blank"
            className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
          >
            Open
          </Link>
        </div>
      </Card>

      {sheet.notes ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm">{sheet.notes}</p>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <h2 className="mb-3 font-medium">Edit SDS</h2>
          <form
            action={updateSdsSheet}
            encType="multipart/form-data"
            className="space-y-3"
          >
            <input type="hidden" name="id" value={sheet.id} />
            <div>
              <Label htmlFor="edit-productName">Product / chemical name</Label>
              <Input
                id="edit-productName"
                name="productName"
                required
                maxLength={200}
                defaultValue={sheet.productName}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input
                  id="edit-manufacturer"
                  name="manufacturer"
                  maxLength={200}
                  defaultValue={sheet.manufacturer ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-casNumber">CAS number</Label>
                <Input
                  id="edit-casNumber"
                  name="casNumber"
                  maxLength={60}
                  defaultValue={sheet.casNumber ?? ""}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-revisionDate">Revision date</Label>
              <Input
                id="edit-revisionDate"
                name="revisionDate"
                type="date"
                defaultValue={dateInputValue(sheet.revisionDate)}
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                name="notes"
                maxLength={5000}
                defaultValue={sheet.notes ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="edit-file">Replace file (optional, max 15 MB)</Label>
              <Input
                id="edit-file"
                name="file"
                type="file"
                accept="application/pdf,image/*,.doc,.docx"
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
