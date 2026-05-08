import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createToolboxTalk, deleteToolboxTalk } from "@/lib/actions/toolbox-talks";
import { formatDate } from "@/lib/utils";

export default async function ToolboxTalksPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const [presenters, talks] = await Promise.all([
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
    prisma.toolboxTalk.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "desc" },
      include: {
        presenter: { select: { name: true, email: true } },
        _count: { select: { attendances: true } },
      },
    }),
  ]);

  const todayInput = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Toolbox Talks</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Log safety talks and track attendance for your crew.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Schedule a talk</h2>
        {presenters.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Add at least one member on the Users page before scheduling a talk.
          </p>
        ) : (
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
            <div className="md:col-span-2">
              <Label>Notes / talking points (optional)</Label>
              <Textarea name="notes" maxLength={10000} placeholder="Key points covered" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create talk</Button>
            </div>
          </form>
        )}
      </Card>

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
