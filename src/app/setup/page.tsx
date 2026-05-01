import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFirstAdmin, isSetupComplete } from "@/lib/actions/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">First-time setup</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Create the initial Super Admin account. This page will be disabled after
          a Super Admin exists.
        </p>

        <form action={createFirstAdmin} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required minLength={1} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Minimum 8 characters.
            </p>
          </div>
          <Button type="submit" className="w-full">
            Create Super Admin
          </Button>
        </form>
      </Card>
    </div>
  );
}
