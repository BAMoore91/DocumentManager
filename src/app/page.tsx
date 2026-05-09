import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSetupComplete } from "@/lib/actions/setup";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  CloudOff,
  FileSignature,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  HardHat,
  History,
  ListChecks,
  MapPin,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Feature = {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
};

const featuresByGroup: { name: string; tagline: string; items: Feature[] }[] = [
  {
    name: "Compliance & records",
    tagline: "Stay defensible during audits, OSHA visits, and insurance renewals.",
    items: [
      {
        icon: FileText,
        title: "Documents with expirations",
        description:
          "Upload certificates, licenses, and insurance with expiration tracking and automatic alerts when they're about to lapse.",
      },
      {
        icon: ClipboardCheck,
        title: "Required documents per role",
        description:
          "Define which documents each title (Foreman, Crew Leader, etc.) must have and watch a real-time compliance percentage roll up across your org.",
      },
      {
        icon: GraduationCap,
        title: "Training & certifications",
        description:
          "OSHA-10, First Aid, Forklift — track completion, instructor, hours, certificate, and auto-calculated expiration. Per-user training matrix.",
      },
      {
        icon: AlertTriangle,
        title: "Incident reporting (OSHA 300)",
        description:
          "Log injuries, near-misses, and recordable cases with photos. Year-to-date Form 300A summary metrics built-in.",
      },
      {
        icon: History,
        title: "Activity log",
        description:
          "Every sign-in, document upload, and member change is captured with actor, IP, and timestamp — searchable per-org or platform-wide.",
      },
    ],
  },
  {
    name: "Field operations",
    tagline: "Tools your crews actually use on the truck and at the trailer.",
    items: [
      {
        icon: HardHat,
        title: "JHA & hazard reports",
        description:
          "Anyone in the org can file a hazard report with photos. Severity + status workflow with linkable corrective actions.",
      },
      {
        icon: Wrench,
        title: "Equipment inspections",
        description:
          "Forklift, lift, harness, ladder logs with pass/fail/out-of-service. A failing inspection auto-flips the equipment to OUT_OF_SERVICE.",
      },
      {
        icon: ScrollText,
        title: "Permits-to-Work",
        description:
          "Hot work, confined space, LOTO, working at heights — issued, recipient signs, status tracked, expires automatically.",
      },
      {
        icon: ListChecks,
        title: "Pre-Task Plans",
        description:
          "Daily, task-specific plans the crew acknowledges with a signature before work begins.",
      },
      {
        icon: ClipboardList,
        title: "Safety audits",
        description:
          "Reusable checklist templates (PASS / FAIL / N/A). Score auto-calculates and audits link to the corrective actions they spawn.",
      },
      {
        icon: HardHat,
        title: "Toolbox talks",
        description:
          "Schedule, assign by role or individual, capture attendance with signatures, and surface what each member is expected to attend on their dashboard.",
      },
      {
        icon: FlaskConical,
        title: "SDS library",
        description:
          "Searchable Safety Data Sheets by product, manufacturer, or CAS number. Track revision dates per chemical.",
      },
      {
        icon: MapPin,
        title: "Sites & projects",
        description:
          "Tag every JHA, talk, permit, audit, equipment, and inspection to a specific jobsite. One source of truth per project.",
      },
      {
        icon: Truck,
        title: "Subcontractors",
        description:
          "Track subs, COIs, and prequalification status. Expiring insurance is flagged automatically.",
      },
    ],
  },
  {
    name: "Knowledge & communication",
    tagline: "Get information to the field — and pull insight back.",
    items: [
      {
        icon: BookOpen,
        title: "Knowledge Base",
        description:
          "Publish SOPs, policies, and training materials with attachments. Searchable for everyone in the org.",
      },
      {
        icon: MessageSquare,
        title: "Safety forum",
        description:
          "Threaded discussions for the crew. Notifications when someone replies on a topic you've participated in.",
      },
      {
        icon: ClipboardList,
        title: "Custom forms",
        description:
          "Build your own daily checklists, sign-offs, and incident reports. Six field types including dropdowns and multi-select. Works offline.",
      },
      {
        icon: Calendar,
        title: "Calendar view",
        description:
          "Document expirations, events, toolbox talks, and assignments in one month grid — color-coded by type and status.",
      },
      {
        icon: FileSignature,
        title: "Digital signatures",
        description:
          "Capture signatures on attendance, permits, and acknowledgements with a touch-friendly signature pad.",
      },
    ],
  },
  {
    name: "Insight & control",
    tagline: "Roll-ups for the office, drilldowns for the supervisor.",
    items: [
      {
        icon: Gauge,
        title: "TRIR / DART reports",
        description:
          "Year-to-date OSHA-standard rates plus leading indicators (TBTs held, audits, permits, trainings completed, CAPAs open vs closed).",
      },
      {
        icon: CheckCircle2,
        title: "Corrective Actions (CAPA)",
        description:
          "Track action items from JHAs, incidents, audits, and observations to assignment, completion, and admin verification.",
      },
      {
        icon: Activity,
        title: "Per-user dashboards",
        description:
          "Each member sees their required documents, training expirations, assigned toolbox talks, and notifications in one view.",
      },
      {
        icon: Users,
        title: "Multi-organization",
        description:
          "Run multiple companies under one platform with strict org isolation. Custom roles per organization. Super Admin oversight.",
      },
      {
        icon: ShieldCheck,
        title: "Archive vs delete",
        description:
          "Removing a user offers a clear choice — keep documents and history (Archive) or scrub everything (Permanently Delete) with a typed-confirmation failsafe.",
      },
    ],
  },
];

export default async function Home() {
  if (!(await isSetupComplete())) redirect("/setup");

  const session = await auth();
  if (session?.user) {
    if (session.user.role === "SUPER_ADMIN") redirect("/super-admin");
    if (session.user.role === "ORG_ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Top bar */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary))]" />
            DocManager
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[hsl(var(--border))] bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(var(--background))]">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[hsl(var(--primary))]">
            Safety, training, and compliance — together
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            One platform for the office, the trailer, and the truck.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
            DocManager keeps certificates, training records, hazards,
            permits, toolbox talks, and audits in one auditable place. Built
            for crews working without signal — installs as an app and works
            offline.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
            >
              Sign in
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border))] px-5 text-sm font-medium hover:bg-[hsl(var(--muted))]"
            >
              Browse features
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5">
              <CloudOff className="h-4 w-4" /> Works offline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cloud className="h-4 w-4" /> Auto-syncs when online
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Multi-org architecture
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileSignature className="h-4 w-4" /> Captures digital signatures
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        {featuresByGroup.map((group) => (
          <div key={group.name} className="mb-16 last:mb-0">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">{group.name}</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {group.tagline}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:border-[hsl(var(--primary))]"
                  >
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-medium">{f.title}</h3>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      {f.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Built for the field */}
      <section className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold">Built for the field</h2>
              <p className="mt-3 text-[hsl(var(--muted-foreground))]">
                Field workers rarely have a steady connection. DocManager
                installs as a Progressive Web App on phones and laptops, and
                custom forms keep working when the signal drops.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CloudOff className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>
                    Submit forms offline — they queue locally and upload
                    automatically when the device reconnects.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Cloud className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>
                    Header indicator shows when you're offline and how many
                    submissions are pending.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <FileSignature className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>
                    Touch-friendly signature pad for attendance, permit
                    acknowledgements, and pre-task plans.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>
                    Print/PDF export on every detail page so paper records are
                    always one tap away.
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6">
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                What you'll see in the app
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200">
                  <span className="inline-flex items-center gap-1">
                    <CloudOff className="h-3.5 w-3.5" /> Offline · 2 pending
                  </span>
                  <span className="opacity-70">Auto-sync ready</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  2 offline submissions uploaded
                </div>
                <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-200">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Required: OSHA-10
                  </span>
                  <span>Valid · expires May 9, 2027</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
                  <span>Toolbox talk: Heat stress this week</span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    Assigned · 12 expected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold">Ready to roll it out?</h2>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Sign in to your organization to get started.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-6 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
            DocManager
          </div>
          <div>Built for safety, training, and document compliance.</div>
        </div>
      </footer>
    </div>
  );
}
