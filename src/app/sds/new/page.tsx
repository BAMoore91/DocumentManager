import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SdsNewForm } from "@/components/sds-new-form";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

export default async function NewSdsPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  if (session.user.role !== "ORG_ADMIN") redirect("/sds");

  const aiEnabled = isAnthropicConfigured();

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
          {aiEnabled
            ? " Pick a PDF and the form will pre-fill from its contents."
            : ""}
        </p>
      </div>

      <Card>
        <SdsNewForm aiEnabled={aiEnabled} />
      </Card>
    </div>
  );
}
