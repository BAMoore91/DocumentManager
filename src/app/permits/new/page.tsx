import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPermit } from "@/lib/actions/permits";

export default async function NewPermitPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  if (session.user.role !== "ORG_ADMIN") redirect("/permits");
  const orgId = session.user.organizationId;

  const [members, sites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return (
    <div className="space-y-6">
      <Link
        href="/permits"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Permits
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Issue permit-to-work</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Document the hazards and controls before high-risk work begins.
        </p>
      </div>

      <Card>
        <form action={createPermit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="type">Permit type</Label>
              <Select id="type" name="type" required defaultValue="HOT_WORK">
                <option value="HOT_WORK">Hot work</option>
                <option value="CONFINED_SPACE">Confined space</option>
                <option value="LOCKOUT_TAGOUT">Lockout / tagout</option>
                <option value="WORKING_AT_HEIGHTS">Working at heights</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="EXCAVATION">Excavation</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title / description</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" name="location" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="siteId">Site</Label>
              <Select id="siteId" name="siteId" defaultValue="">
                <option value="">— No site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="validFrom">Valid from</Label>
              <Input
                id="validFrom"
                name="validFrom"
                type="datetime-local"
                required
                defaultValue={today.toISOString().slice(0, 16)}
              />
            </div>
            <div>
              <Label htmlFor="validUntil">Valid until</Label>
              <Input
                id="validUntil"
                name="validUntil"
                type="datetime-local"
                required
                defaultValue={tomorrow.toISOString().slice(0, 16)}
              />
            </div>
            <div>
              <Label htmlFor="recipientId">Recipient (member)</Label>
              <Select id="recipientId" name="recipientId" defaultValue="">
                <option value="">— External / non-member —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="recipientName">Or recipient name</Label>
              <Input id="recipientName" name="recipientName" maxLength={200} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Work to be performed</Label>
            <Textarea id="description" name="description" maxLength={5000} className="min-h-[80px]" />
          </div>
          <div>
            <Label htmlFor="hazards">Hazards identified</Label>
            <Textarea id="hazards" name="hazards" maxLength={5000} className="min-h-[80px]" />
          </div>
          <div>
            <Label htmlFor="controls">Controls in place</Label>
            <Textarea id="controls" name="controls" maxLength={5000} className="min-h-[80px]" />
          </div>
          <Button type="submit">Issue permit</Button>
        </form>
      </Card>
    </div>
  );
}
