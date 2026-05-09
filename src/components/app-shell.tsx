"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";
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
    { href: "/incidents", label: "Incidents" },
    { href: "/corrective-actions", label: "Corrective Actions" },
    { href: "/sds", label: "SDS" },
    { href: "/forms", label: "Forms" },
    { href: "/forum", label: "Forum" },
    { href: "/kb", label: "Knowledge Base" },
    { href: "/admin/settings", label: "Settings" },
  ],
  USER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/documents", label: "My Documents" },
    { href: "/jha", label: "JHA" },
    { href: "/incidents", label: "Incidents" },
    { href: "/corrective-actions", label: "Corrective Actions" },
    { href: "/sds", label: "SDS" },
    { href: "/forms", label: "Forms" },
    { href: "/forum", label: "Forum" },
    { href: "/kb", label: "Knowledge Base" },
  ],
};

function pickActiveHref(items: NavItem[], pathname: string): string {
  let active = "";
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (item.href.length > active.length) active = item.href;
    }
  }
  return active;
}

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
  const pathname = usePathname();
  const activeHref = pickActiveHref(items, pathname);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setOpen(true);
    }
  }, []);

  function closeOnMobile() {
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) {
      setOpen(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-md p-1.5 hover:bg-[hsl(var(--muted))]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="font-semibold">
            DocManager
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="hidden text-right sm:block">
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
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 top-14 z-20 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="Primary navigation"
        className={cn(
          "fixed bottom-0 left-0 top-14 z-30 w-64 overflow-y-auto border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="flex flex-col gap-0.5 p-3 text-sm">
          {items.map((item) => {
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeOnMobile}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 transition",
                  isActive
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main
        className={cn(
          "transition-[margin] duration-200",
          open ? "md:ml-64" : "ml-0",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
