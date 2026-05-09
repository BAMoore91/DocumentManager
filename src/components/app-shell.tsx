import Link from "next/link";
import { signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";
import type { Role } from "@prisma/client";

type NavItem = { href: string; label: string };

const navByRole: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/super-admin", label: "Dashboard" },
    { href: "/super-admin/organizations", label: "Organizations" },
    { href: "/super-admin/users", label: "Users" },
    { href: "/super-admin/documents", label: "Documents" },
  ],
  ORG_ADMIN: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/documents", label: "Documents" },
    { href: "/admin/calendar", label: "Calendar" },
    { href: "/admin/toolbox-talks", label: "Toolbox Talks" },
    { href: "/jha", label: "JHA" },
    { href: "/forms", label: "Forms" },
    { href: "/forum", label: "Forum" },
    { href: "/kb", label: "Knowledge Base" },
    { href: "/admin/settings", label: "Settings" },
  ],
  USER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/documents", label: "My Documents" },
    { href: "/jha", label: "JHA" },
    { href: "/forms", label: "Forms" },
    { href: "/forum", label: "Forum" },
    { href: "/kb", label: "Knowledge Base" },
  ],
};

export function AppShell({
  role,
  email,
  orgName,
  children,
}: {
  role: Role;
  email: string;
  orgName?: string | null;
  children: React.ReactNode;
}) {
  const items = navByRole[role];

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              DocManager
            </Link>
            <nav className="hidden gap-4 text-sm md:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right md:block">
              <div className="font-medium">{email}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {role.replace("_", " ")}
                {orgName ? ` · ${orgName}` : ""}
              </div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-sm md:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
