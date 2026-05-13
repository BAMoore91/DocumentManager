import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import {
  ChevronRight,
  Tags,
  ClipboardCheck,
  FileText,
  BookOpen,
  MapPin,
  GraduationCap,
  ListChecks,
  Users,
  History,
} from "lucide-react";

const sections = [
  {
    href: "/admin/settings/users",
    title: "Members",
    description:
      "Add, archive, or restore organization members and assign their titles.",
    icon: Users,
  },
  {
    href: "/admin/settings/logs",
    title: "Activity log",
    description:
      "Audit trail of every recorded action — sign-ins, uploads, member changes, hazard reports, and more.",
    icon: History,
  },
  {
    href: "/admin/settings/roles",
    title: "Custom roles",
    description: "Job titles within your organization (Foreman, Crew Leader, Safety Officer, etc.).",
    icon: Tags,
  },
  {
    href: "/admin/settings/sites",
    title: "Sites / Projects",
    description:
      "Define jobsites referenced by Equipment, Permits, Audits, and Pre-Task Plans.",
    icon: MapPin,
  },
  {
    href: "/admin/settings/required-documents",
    title: "Required documents",
    description:
      "Documents members must have on file, mapped to the roles they apply to.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/settings/training",
    title: "Training catalog",
    description:
      "Define training courses (OSHA-10, First Aid, Forklift...) and which roles they apply to.",
    icon: GraduationCap,
  },
  {
    href: "/admin/settings/audit-templates",
    title: "Audit templates",
    description:
      "Pre-built checklists (e.g. 'Weekly site walk') so audits start with the right items.",
    icon: ListChecks,
  },
  {
    href: "/admin/settings/forms",
    title: "Forms",
    description:
      "Build custom fillable forms — daily checklists, incident reports, sign-offs.",
    icon: FileText,
  },
  {
    href: "/admin/settings/kb",
    title: "Knowledge Base",
    description:
      "Publish reference articles and uploads — policies, SOPs, training materials.",
    icon: BookOpen,
  },
];

export default async function SettingsIndexPage() {
  const session = await auth();
  if (!session?.user.organizationId) redirect("/login");
  const orgId = session.user.organizationId;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Manage settings for {org.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="block">
              <Card className="h-full transition hover:border-[hsl(var(--primary))]">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-[hsl(var(--muted))] p-2 text-[hsl(var(--foreground))]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="font-medium">{s.title}</h2>
                      <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      {s.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
