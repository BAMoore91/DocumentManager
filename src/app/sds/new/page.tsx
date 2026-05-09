import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSdsSheet } from "@/lib/actions/sds";

export default async function NewSdsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  if (session.user.role !== "ORG_ADMIN") redirect("/sds");

  return (
    <div className="space-y-6">
      <Link
        href="/sds"
        className="inline-block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Safety Data Sheets
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Upload SDS</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Add a Safety Data Sheet PDF to the organization's library.
        </p>
      </div>

      <Card>
        <form
          action={createSdsSheet}
          encType="multipart/form-data"
          className="space-y-3"
        >
          <div>
            <Label htmlFor="productName">Product / chemical name</Label>
            <Input
              id="productName"
              name="productName"
              required
              maxLength={200}
              placeholder="Acetone"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="manufacturer">Manufacturer (optional)</Label>
              <Input id="manufacturer" name="manufacturer" maxLength={200} placeholder="3M" />
            </div>
            <div>
              <Label htmlFor="casNumber">CAS number (optional)</Label>
              <Input
                id="casNumber"
                name="casNumber"
                maxLength={60}
                placeholder="67-64-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="revisionDate">Revision date (optional)</Label>
            <Input id="revisionDate" name="revisionDate" type="date" />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={5000}
              placeholder="Hazard class, where it's used, etc."
            />
          </div>
          <div>
            <Label htmlFor="file">SDS file (PDF preferred, max 15 MB)</Label>
            <Input
              id="file"
              name="file"
              type="file"
              required
              accept="application/pdf,image/*,.doc,.docx"
            />
          </div>
          <Button type="submit">Upload SDS</Button>
        </form>
      </Card>
    </div>
  );
}
