import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createSubcontractor,
  deleteSubcontractor,
  updateSubcontractor,
} from "@/lib/actions/subcontractors";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export default async function SubcontractorsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  if (session.user.role !== "ORG_ADMIN") redirect("/dashboard");
  const orgId = session.user.organizationId;

  const subs = await prisma.subcontractor.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subcontractors</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Track subs, their insurance certificates, and prequalification status.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Add subcontractor</h2>
        <form
          action={createSubcontractor}
          encType="multipart/form-data"
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <div>
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="trade">Trade</Label>
            <Input id="trade" name="trade" maxLength={120} placeholder="Electrical, masonry…" />
          </div>
          <div>
            <Label htmlFor="contactName">Contact name</Label>
            <Input id="contactName" name="contactName" maxLength={200} />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" maxLength={200} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" name="contactPhone" maxLength={60} />
          </div>
          <div>
            <Label htmlFor="insuranceExpiresAt">COI expires</Label>
            <Input id="insuranceExpiresAt" name="insuranceExpiresAt" type="date" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="insurance">Certificate of Insurance (PDF)</Label>
            <Input
              id="insurance"
              name="insurance"
              type="file"
              accept="application/pdf,image/*"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={5000} />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="prequalified" className="h-4 w-4" />
              Prequalified
            </label>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Add subcontractor</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {subs.map((s) => {
          const expired = s.insuranceExpiresAt && s.insuranceExpiresAt < today;
          return (
            <div key={s.id} className="rounded-md border border-[hsl(var(--border))] p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.prequalified ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Prequalified
                      </span>
                    ) : (
                      <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                        Not prequalified
                      </span>
                    )}
                    {expired ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                        COI expired
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.trade ? `${s.trade} · ` : ""}
                    {s.contactName ?? "—"}
                    {s.contactEmail ? ` · ${s.contactEmail}` : ""}
                    {s.contactPhone ? ` · ${s.contactPhone}` : ""}
                    {s.insuranceExpiresAt
                      ? ` · COI ${formatDate(s.insuranceExpiresAt)}`
                      : ""}
                  </div>
                  {s.insuranceUrl ? (
                    <Link
                      href={s.insuranceUrl}
                      target="_blank"
                      className="mt-1 inline-block text-xs text-[hsl(var(--primary))] hover:underline"
                    >
                      {s.insuranceName ?? "Download COI"}
                      {s.insuranceSize ? ` (${formatBytes(s.insuranceSize)})` : ""}
                    </Link>
                  ) : null}
                </div>
                <form action={deleteSubcontractor}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
              <form
                action={updateSubcontractor}
                encType="multipart/form-data"
                className="grid grid-cols-1 gap-2 md:grid-cols-3"
              >
                <input type="hidden" name="id" value={s.id} />
                <div className="md:col-span-1">
                  <Label className="text-xs">Name</Label>
                  <Input name="name" required maxLength={200} defaultValue={s.name} />
                </div>
                <div>
                  <Label className="text-xs">Trade</Label>
                  <Input name="trade" maxLength={120} defaultValue={s.trade ?? ""} />
                </div>
                <div>
                  <Label className="text-xs">Contact name</Label>
                  <Input
                    name="contactName"
                    maxLength={200}
                    defaultValue={s.contactName ?? ""}
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact email</Label>
                  <Input
                    name="contactEmail"
                    type="email"
                    maxLength={200}
                    defaultValue={s.contactEmail ?? ""}
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact phone</Label>
                  <Input
                    name="contactPhone"
                    maxLength={60}
                    defaultValue={s.contactPhone ?? ""}
                  />
                </div>
                <div>
                  <Label className="text-xs">COI expires</Label>
                  <Input
                    name="insuranceExpiresAt"
                    type="date"
                    defaultValue={
                      s.insuranceExpiresAt
                        ? s.insuranceExpiresAt.toISOString().slice(0, 10)
                        : ""
                    }
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Replace COI (optional)</Label>
                  <Input name="insurance" type="file" accept="application/pdf,image/*" />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Notes</Label>
                  <Textarea name="notes" maxLength={5000} defaultValue={s.notes ?? ""} />
                </div>
                <div className="md:col-span-3 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="prequalified"
                      defaultChecked={s.prequalified}
                      className="h-4 w-4"
                    />
                    Prequalified
                  </label>
                  <Button type="submit" variant="secondary" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            </div>
          );
        })}
        {subs.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              No subcontractors yet.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
