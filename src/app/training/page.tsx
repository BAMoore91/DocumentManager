import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/form-modal";
import { createTrainingRecord, deleteTrainingRecord } from "@/lib/actions/training";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ORG_ADMIN";

  const [courses, members, records] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.trainingRecord.findMany({
      where: {
        organizationId: orgId,
        ...(isAdmin ? {} : { userId: session.user.id }),
      },
      orderBy: { completedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { name: true } },
      },
    }),
  ]);

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Training records</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {isAdmin
              ? "Log course completions for members and track expirations."
              : "Your completed training and expiration dates."}
          </p>
        </div>
        {isAdmin && courses.length > 0 ? (
          <FormModal triggerLabel="Log completion" title="Log training completion" size="lg">
            <form
              action={createTrainingRecord}
              encType="multipart/form-data"
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div>
                <Label htmlFor="userId">Member</Label>
                <Select id="userId" name="userId" required>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="courseId">Course</Label>
                <Select id="courseId" name="courseId" required>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="completedAt">Completed</Label>
                <Input id="completedAt" name="completedAt" type="date" required />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
              <div>
                <Label htmlFor="instructor">Instructor</Label>
                <Input id="instructor" name="instructor" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" name="provider" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="hours">Hours</Label>
                <Input id="hours" name="hours" type="number" min={0} max={9999} step="0.25" />
              </div>
              <div>
                <Label htmlFor="certificate">Certificate (PDF or image)</Label>
                <Input
                  id="certificate"
                  name="certificate"
                  type="file"
                  accept="application/pdf,image/*"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" maxLength={2000} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Save record</Button>
              </div>
            </form>
          </FormModal>
        ) : null}
      </div>
      {isAdmin && courses.length === 0 ? (
        <Card>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Add at least one course in the{" "}
            <Link href="/admin/settings/training" className="text-[hsl(var(--primary))] hover:underline">
              Training catalog
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              {isAdmin ? <th className="px-4 py-3">Member</th> : null}
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Cert</th>
              {isAdmin ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const expired = r.expiresAt && r.expiresAt < today;
              return (
                <tr key={r.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  {isAdmin ? (
                    <td className="px-4 py-3 font-medium">
                      {r.user.name ?? r.user.email}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">{r.course.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(r.completedAt)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 whitespace-nowrap",
                      expired && "text-red-600 dark:text-red-300",
                    )}
                  >
                    {r.expiresAt ? formatDate(r.expiresAt) : "—"}
                    {expired ? " · expired" : ""}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.hours ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.certificateUrl ? (
                      <Link
                        href={r.certificateUrl}
                        target="_blank"
                        className="text-[hsl(var(--primary))] hover:underline"
                      >
                        {r.certificateName ?? "Download"}
                        {r.certificateSize ? ` (${formatBytes(r.certificateSize)})` : ""}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right">
                      <form action={deleteTrainingRecord}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" variant="danger" size="sm">
                          Delete
                        </Button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 5}
                  className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]"
                >
                  No training records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
