import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createJhaReport } from "@/lib/actions/jha";

export default async function NewJhaPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");

  return (
    <div className="space-y-6">
      <Link
        href="/jha"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Hazard reports
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Report a hazard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Describe what you saw, where, and how serious it is. Add photos if you
          can — they help everyone respond faster.
        </p>
      </div>

      <Card>
        <form
          action={createJhaReport}
          encType="multipart/form-data"
          className="space-y-3"
        >
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              placeholder="Loose handrail on scaffold level 2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" name="location" maxLength={200} placeholder="Building B, floor 3" />
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select id="severity" name="severity" required defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="hazardDescription">What's the hazard?</Label>
            <Textarea
              id="hazardDescription"
              name="hazardDescription"
              required
              maxLength={10000}
              className="min-h-[120px]"
              placeholder="Describe the hazard…"
            />
          </div>
          <div>
            <Label htmlFor="mitigation">Mitigation / what was done (optional)</Label>
            <Textarea
              id="mitigation"
              name="mitigation"
              maxLength={10000}
              className="min-h-[80px]"
              placeholder="Steps already taken or recommended controls…"
            />
          </div>
          <div>
            <Label htmlFor="photos">Photos (optional, max 15 MB each)</Label>
            <Input
              id="photos"
              name="photos"
              type="file"
              accept="image/*"
              multiple
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              You can attach multiple images.
            </p>
          </div>
          <Button type="submit">Submit report</Button>
        </form>
      </Card>
    </div>
  );
}
