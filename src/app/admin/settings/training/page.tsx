import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createTrainingCourse,
  deleteTrainingCourse,
  updateTrainingCourse,
} from "@/lib/actions/training";

export default async function TrainingCatalogPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [courses, customRoles] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        customRoles: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
    }),
    prisma.customRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Settings
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Training catalog</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define training courses your members must complete. Map each course to
          the roles it applies to and set a default validity period for
          auto-calculated expirations.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Add a course</h2>
        <form action={createTrainingCourse} className="space-y-3">
          <input type="hidden" name="organizationId" value={orgId} />
          <div>
            <Label htmlFor="name">Course name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="OSHA 10" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" maxLength={2000} />
          </div>
          <div>
            <Label htmlFor="defaultValidityDays">Default validity (days)</Label>
            <Input
              id="defaultValidityDays"
              name="defaultValidityDays"
              type="number"
              min={0}
              max={36500}
              placeholder="e.g. 1825 for 5 years"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Leave blank for no expiration.
            </p>
          </div>
          {customRoles.length > 0 ? (
            <div>
              <Label>Applies to roles</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                {customRoles.map((r) => (
                  <label key={r.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="customRoleIds"
                      value={r.id}
                      className="h-4 w-4"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <Button type="submit">Add course</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {courses.map((c) => {
          const assignedIds = new Set(c.customRoles.map((r) => r.id));
          return (
            <div
              key={c.id}
              className="rounded-md border border-[hsl(var(--border))] p-3"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {c._count.records} record{c._count.records === 1 ? "" : "s"}
                    {c.defaultValidityDays
                      ? ` · default validity ${c.defaultValidityDays} days`
                      : ""}
                  </div>
                </div>
                <form action={deleteTrainingCourse}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
              <form action={updateTrainingCourse} className="space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Name
                    </Label>
                    <Input name="name" defaultValue={c.name} required maxLength={120} />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Default validity (days)
                    </Label>
                    <Input
                      name="defaultValidityDays"
                      type="number"
                      min={0}
                      max={36500}
                      defaultValue={c.defaultValidityDays ?? ""}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Description
                    </Label>
                    <Textarea
                      name="description"
                      maxLength={2000}
                      defaultValue={c.description ?? ""}
                    />
                  </div>
                </div>
                {customRoles.length > 0 ? (
                  <div>
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Applies to
                    </Label>
                    <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                      {customRoles.map((cr) => (
                        <label key={cr.id} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="customRoleIds"
                            value={cr.id}
                            defaultChecked={assignedIds.has(cr.id)}
                            className="h-4 w-4"
                          />
                          {cr.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </form>
            </div>
          );
        })}
        {courses.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No courses yet — add one above.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
