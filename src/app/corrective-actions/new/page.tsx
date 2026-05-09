import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCorrectiveAction } from "@/lib/actions/corrective-actions";

export default async function NewCapaPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceType?: string; sourceId?: string; title?: string }>;
}) {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const { sourceType, sourceId, title } = await searchParams;

  const members = await prisma.user.findMany({
    where: { organizationId: orgId },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/corrective-actions"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Corrective actions
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New corrective action</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Assign an owner and a due date so it can be tracked through to
          verification.
        </p>
      </div>

      <Card>
        <form action={createCorrectiveAction} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} defaultValue={title ?? ""} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" maxLength={5000} className="min-h-[100px]" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="sourceType">Source</Label>
              <Select id="sourceType" name="sourceType" required defaultValue={sourceType ?? "OTHER"}>
                <option value="JHA">JHA / Hazard report</option>
                <option value="INCIDENT">Incident</option>
                <option value="AUDIT">Audit / inspection</option>
                <option value="OBSERVATION">Observation</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="sourceId">Source reference (optional)</Label>
              <Input id="sourceId" name="sourceId" maxLength={60} defaultValue={sourceId ?? ""} />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" required defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="assignedToId">Assigned to</Label>
              <Select id="assignedToId" name="assignedToId" defaultValue="">
                <option value="">— Unassigned —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit">Create action</Button>
        </form>
      </Card>
    </div>
  );
}
