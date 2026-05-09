import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteSite, updateSite } from "@/lib/actions/sites";

function dateInputValue(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function SiteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { id } = await params;

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site || site.organizationId !== orgId) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings/sites"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Sites
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {site.status === "ACTIVE" ? "Active" : "Archived"}
            {site.code ? ` · ${site.code}` : ""}
          </p>
        </div>
        <form action={deleteSite}>
          <input type="hidden" name="id" value={site.id} />
          <Button type="submit" variant="danger" size="sm">
            Delete
          </Button>
        </form>
      </div>

      <Card>
        <form action={updateSite} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={site.id} />
          <input type="hidden" name="organizationId" value={orgId} />
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={120} defaultValue={site.name} />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" maxLength={40} defaultValue={site.code ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" maxLength={300} defaultValue={site.address ?? ""} />
          </div>
          <div>
            <Label htmlFor="contactName">Site contact</Label>
            <Input
              id="contactName"
              name="contactName"
              maxLength={120}
              defaultValue={site.contactName ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              maxLength={60}
              defaultValue={site.contactPhone ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              maxLength={300}
              defaultValue={site.emergencyContact ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="musterPoint">Muster point</Label>
            <Input
              id="musterPoint"
              name="musterPoint"
              maxLength={300}
              defaultValue={site.musterPoint ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="openedAt">Opened</Label>
            <Input
              id="openedAt"
              name="openedAt"
              type="date"
              defaultValue={dateInputValue(site.openedAt)}
            />
          </div>
          <div>
            <Label htmlFor="closedAt">Closed</Label>
            <Input
              id="closedAt"
              name="closedAt"
              type="date"
              defaultValue={dateInputValue(site.closedAt)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={5000}
              defaultValue={site.notes ?? ""}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
