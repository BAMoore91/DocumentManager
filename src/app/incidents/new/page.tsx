import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createIncident } from "@/lib/actions/incidents";

export default async function NewIncidentPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const members = await prisma.user.findMany({
    where: { organizationId: orgId },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });

  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <Link
        href="/incidents"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Incidents
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Report incident</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Document a work-related injury, illness, or near-miss. Fields mirror
          OSHA Form 301 — fill in what applies and leave the rest blank.
        </p>
      </div>

      <form
        action={createIncident}
        encType="multipart/form-data"
        className="space-y-6"
      >
        <Card>
          <h2 className="mb-3 font-medium">Incident</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" required defaultValue="NEAR_MISS">
                <option value="NEAR_MISS">Near miss (no injury)</option>
                <option value="FIRST_AID">First aid only</option>
                <option value="RECORDABLE">Recordable injury / illness</option>
                <option value="RESTRICTED_DUTY">Restricted duty</option>
                <option value="LOST_TIME">Lost time</option>
                <option value="FATALITY">Fatality</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="occurredAt">When did it happen?</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                required
                defaultValue={today}
              />
            </div>
            <div>
              <Label htmlFor="caseNumber">Case # (optional)</Label>
              <Input id="caseNumber" name="caseNumber" maxLength={60} />
            </div>
            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" name="location" maxLength={200} placeholder="Building B, floor 3" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">What happened?</Label>
              <Textarea
                id="description"
                name="description"
                required
                maxLength={20000}
                className="min-h-[120px]"
                placeholder="Describe the incident in your own words…"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Person involved</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="personName">Name</Label>
              <Input id="personName" name="personName" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="personUserId">Member (optional)</Label>
              <Select id="personUserId" name="personUserId" defaultValue="">
                <option value="">— Not a member / external —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="jobTitle">Job title at time of incident</Label>
              <Input id="jobTitle" name="jobTitle" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="bodyPart">Body part affected</Label>
              <Input id="bodyPart" name="bodyPart" maxLength={120} placeholder="Right hand, lower back…" />
            </div>
            <div>
              <Label htmlFor="injuryType">Injury / illness type</Label>
              <Input
                id="injuryType"
                name="injuryType"
                maxLength={120}
                placeholder="Cut, sprain, burn, exposure…"
              />
            </div>
            <div>
              <Label htmlFor="treatmentReceived">Treatment received</Label>
              <Input
                id="treatmentReceived"
                name="treatmentReceived"
                maxLength={2000}
                placeholder="On-site first aid, ER visit, prescription…"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">OSHA classification</h2>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            Fill these in for recordable cases. Days are counted only for the
            incident's resulting absence or restriction.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="daysAway">Days away from work</Label>
              <Input
                id="daysAway"
                name="daysAway"
                type="number"
                min={0}
                max={9999}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="daysRestricted">Days on job transfer / restriction</Label>
              <Input
                id="daysRestricted"
                name="daysRestricted"
                type="number"
                min={0}
                max={9999}
                placeholder="0"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Investigation</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rootCause">Root cause</Label>
              <Textarea
                id="rootCause"
                name="rootCause"
                maxLength={5000}
                className="min-h-[80px]"
                placeholder="What was the underlying cause?"
              />
            </div>
            <div>
              <Label htmlFor="correctiveActions">Corrective actions taken / planned</Label>
              <Textarea
                id="correctiveActions"
                name="correctiveActions"
                maxLength={5000}
                className="min-h-[80px]"
                placeholder="What's being done to prevent this from happening again?"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Photos (optional)</h2>
          <Label htmlFor="photos">Choose images (max 15 MB each)</Label>
          <Input
            id="photos"
            name="photos"
            type="file"
            accept="image/*"
            multiple
          />
        </Card>

        <Button type="submit">Submit report</Button>
      </form>
    </div>
  );
}
