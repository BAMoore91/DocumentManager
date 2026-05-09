import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSite, deleteSite, setSiteStatus } from "@/lib/actions/sites";
import { cn, formatDate } from "@/lib/utils";

export default async function SitesSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const sites = await prisma.site.findMany({
    where: { organizationId: orgId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Sites / Projects</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define the jobsites or projects your crews work on. Sites can be
          referenced by Equipment, Permits, Audits, and Pre-Task Plans.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Add a site</h2>
        <form action={createSite} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="organizationId" value={orgId} />
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="South Tower" />
          </div>
          <div>
            <Label htmlFor="code">Code (optional)</Label>
            <Input id="code" name="code" maxLength={40} placeholder="ST-2026" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" maxLength={300} />
          </div>
          <div>
            <Label htmlFor="contactName">Site contact</Label>
            <Input id="contactName" name="contactName" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" name="contactPhone" maxLength={60} />
          </div>
          <div>
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input id="emergencyContact" name="emergencyContact" maxLength={300} />
          </div>
          <div>
            <Label htmlFor="musterPoint">Muster point</Label>
            <Input id="musterPoint" name="musterPoint" maxLength={300} />
          </div>
          <div>
            <Label htmlFor="openedAt">Opened</Label>
            <Input id="openedAt" name="openedAt" type="date" />
          </div>
          <div>
            <Label htmlFor="closedAt">Closed (optional)</Label>
            <Input id="closedAt" name="closedAt" type="date" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={5000} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Add site</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-2">
        {sites.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/settings/sites/${s.id}`}
                  className="font-medium hover:underline"
                >
                  {s.name}
                </Link>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    s.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {s.status === "ACTIVE" ? "Active" : "Archived"}
                </span>
                {s.code ? (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.code}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {s.address ?? "—"}
                {s.openedAt ? ` · Opened ${formatDate(s.openedAt)}` : ""}
                {s.closedAt ? ` · Closed ${formatDate(s.closedAt)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <form action={setSiteStatus}>
                <input type="hidden" name="id" value={s.id} />
                <input
                  type="hidden"
                  name="status"
                  value={s.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {s.status === "ACTIVE" ? "Archive" : "Reactivate"}
                </Button>
              </form>
              <Link
                href={`/admin/settings/sites/${s.id}`}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Edit
              </Link>
              <form action={deleteSite}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ))}
        {sites.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No sites yet — add one above.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
