import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { isSetupComplete } from "@/lib/actions/setup";

function roleHome(role?: string) {
  if (role === "SUPER_ADMIN") return "/super-admin";
  if (role === "ORG_ADMIN") return "/admin";
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; setup?: string }>;
}) {
  if (!(await isSetupComplete())) redirect("/setup");

  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl ?? roleHome(session.user.role));

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const callbackUrl = String(formData.get("callbackUrl") ?? "/");

    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
    } catch (error) {
      if (error instanceof AuthError) {
        const qs = new URLSearchParams({ error: "CredentialsSignin", callbackUrl });
        redirect(`/login?${qs.toString()}`);
      }
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Document Manager — track certificate expirations.
        </p>

        {params.setup === "complete" ? (
          <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
            Super Admin created. Sign in to continue.
          </div>
        ) : null}

        {params.error ? (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            Invalid email or password.
          </div>
        ) : null}

        <form action={login} className="mt-6 space-y-4">
          <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
