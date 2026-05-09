import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPreTaskPlan } from "@/lib/actions/ptp";

export default async function NewPtpPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const sites = await prisma.site.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link
        href="/ptp"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Pre-Task Plans
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New pre-task plan</h1>
      </div>

      <Card>
        <form action={createPreTaskPlan} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} placeholder="Roof tear-off — south side" />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required defaultValue={today} />
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
          </div>
          <div>
            <Label htmlFor="task">Task</Label>
            <Textarea id="task" name="task" required maxLength={2000} className="min-h-[60px]" />
          </div>
          <div>
            <Label htmlFor="hazards">Hazards</Label>
            <Textarea id="hazards" name="hazards" required maxLength={20000} className="min-h-[100px]" />
          </div>
          <div>
            <Label htmlFor="controls">Controls</Label>
            <Textarea id="controls" name="controls" required maxLength={20000} className="min-h-[100px]" />
          </div>
          <div>
            <Label htmlFor="ppe">PPE required</Label>
            <Input id="ppe" name="ppe" maxLength={2000} placeholder="Hard hat, gloves, fall protection…" />
          </div>
          <div>
            <Label htmlFor="emergencyInfo">Emergency / muster info</Label>
            <Input
              id="emergencyInfo"
              name="emergencyInfo"
              maxLength={2000}
              placeholder="Muster point, emergency contact"
            />
          </div>
          <Button type="submit">Create plan</Button>
        </form>
      </Card>
    </div>
  );
}
