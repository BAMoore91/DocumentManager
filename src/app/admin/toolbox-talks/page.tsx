import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { createToolboxTalk, deleteToolboxTalk } from "@/lib/actions/toolbox-talks";
import { formatDate } from "@/lib/utils";

export default async function ToolboxTalksPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [members, customRoles, sites, talks] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        customRole: { select: { name: true } },
      },
    }),
    prisma.customRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.toolboxTalk.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "desc" },
      include: {
        presenter: { select: { name: true, email: true } },
        _count: { select: { attendances: true } },
      },
    }),
  ]);
  const presenters = members;

  const todayInput = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Toolbox Talks</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Log safety talks and track attendance for your crew.
          </p>
        </div>
        {presenters.length > 0 ? (
          <FormModal triggerLabel="Schedule talk" title="Schedule a talk" size="lg">
            <form
              action={createToolboxTalk}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
            <input type="hidden" name="organizationId" value={orgId} />
            <div>
              <Label>Topic</Label>
              <Input name="topic" required maxLength={200} placeholder="Ladder safety" />
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required defaultValue={todayInput} />
            </div>
            <div>
              <Label>Presenter</Label>
              <Select name="presenterId" required>
                {presenters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.name ?? p.email) +
                      (p.customRole?.name ? ` — ${p.customRole.name}` : "")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Input name="location" maxLength={200} placeholder="Job site / yard" />
            </div>
            <div>
              <Label>Site (optional)</Label>
              <Select name="siteId" defaultValue="">
                <option value="">— No site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Notes / talking points (optional)</Label>
              <Textarea name="notes" maxLength={10000} placeholder="Key points covered" />
            </div>
            <div className="md:col-span-2">
              <Label>Assigned to roles (optional)</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                {customRoles.length === 0 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    No custom roles defined yet — add some under Settings → Custom roles.
                  </span>
                ) : (
                  customRoles.map((r) => (
                    <label key={r.id} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="assignedRoleIds"
                        value={r.id}
                        className="h-4 w-4"
                      />
                      {r.name}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Assigned to users (optional)</Label>
              <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto rounded-md border border-[hsl(var(--border))] px-3 py-2">
                {members.map((u) => (
                  <label key={u.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="assignedUserIds"
                      value={u.id}
                      className="h-4 w-4"
                    />
                    {u.name ?? u.email}
                    {u.customRole?.name ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        ({u.customRole.name})
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Assignments are the union of all selected roles' members and any
                individuals you check.
              </p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create talk</Button>
            </div>
            </form>
          </FormModal>
        ) : null}
      </div>
      {presenters.length === 0 ? (
        <Card>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Add at least one member on the Users page before scheduling a talk.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Presenter</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Attendees</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {talks.map((t) => (
              <tr key={t.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/toolbox-talks/${t.id}`} className="hover:underline">
                    {t.topic}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDate(t.date)}</td>
                <td className="px-4 py-3">{t.presenter.name ?? t.presenter.email}</td>
                <td className="px-4 py-3">{t.location ?? "—"}</td>
                <td className="px-4 py-3">{t._count.attendances}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteToolboxTalk}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {talks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No toolbox talks yet — schedule one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
