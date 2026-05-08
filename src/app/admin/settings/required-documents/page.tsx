import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createRequiredDocument,
  deleteRequiredDocument,
  setRequiredDocumentRoles,
} from "@/lib/actions/required-documents";

export default async function RequiredDocumentsSettingsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [customRoles, requiredDocs] = await Promise.all([
    prisma.customRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.requiredDocument.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        customRoles: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
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
        <h1 className="text-2xl font-semibold">Required documents</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define documents members must upload, and assign each one to the roles it
          applies to. Members in those roles will see them as required on their
          dashboard, and compliance is tracked per user and across the organization.
        </p>
      </div>

      <Card>
        {customRoles.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Add at least one custom role under{" "}
            <Link href="/admin/settings/roles" className="text-[hsl(var(--primary))] hover:underline">
              Custom roles
            </Link>{" "}
            before defining required documents.
          </p>
        ) : (
          <form action={createRequiredDocument} className="space-y-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label htmlFor="req-name">Document name</Label>
              <Input id="req-name" name="name" required maxLength={100} placeholder="OSHA-10" />
            </div>
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
            <Button type="submit">Add required document</Button>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {requiredDocs.map((rd) => {
            const assignedIds = new Set(rd.customRoles.map((r) => r.id));
            return (
              <div
                key={rd.id}
                className="rounded-md border border-[hsl(var(--border))] p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{rd.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {rd._count.documents} uploaded
                    </div>
                  </div>
                  <form action={deleteRequiredDocument}>
                    <input type="hidden" name="id" value={rd.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>

                <form
                  action={setRequiredDocumentRoles}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="id" value={rd.id} />
                  <div className="flex-1">
                    <Label className="text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      Applies to
                    </Label>
                    <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                      {customRoles.length === 0 ? (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                          No custom roles defined.
                        </span>
                      ) : (
                        customRoles.map((cr) => (
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
                        ))
                      )}
                    </div>
                  </div>
                  <Button type="submit" variant="secondary" size="sm">
                    Save roles
                  </Button>
                </form>
              </div>
            );
          })}
          {requiredDocs.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No required documents yet.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
