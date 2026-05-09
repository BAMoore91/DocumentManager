import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSetupComplete } from "@/lib/actions/setup";
import { submitContact } from "@/lib/actions/contact";
import { SubmitButton } from "@/components/submit-button";
import { CookieConsent } from "@/components/cookie-consent";
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  if (!(await isSetupComplete())) redirect("/setup");

  const session = await auth();
  if (session?.user) {
    if (session.user.role === "SUPER_ADMIN") redirect("/super-admin");
    if (session.user.role === "ORG_ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  const { contact } = await searchParams;
  const contactSuccess = contact === "success";
  const contactError = contact === "error";

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Top bar */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary))]" />
            DocManager
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a
              href="#contact"
              className="hidden text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] sm:inline"
            >
              Contact us
            </a>
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
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

      {/* Contact */}
      <section
        id="contact"
        className="border-t border-[hsl(var(--border))] scroll-mt-20"
      >
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold">Talk to us</h2>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              Tell us about your team and we'll be in touch about getting your
              organization set up.
            </p>
          </div>

          {contactSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-300" />
              <h3 className="mt-3 text-lg font-medium text-emerald-900 dark:text-emerald-100">
                Thanks — we received your request.
              </h3>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                A team member will reach out within one business day.
              </p>
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100"
                >
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
              {contactError ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950 dark:text-red-200">
                  Something didn't look right — please double-check the fields
                  and try again. Email is required and user count must be a
                  positive number.
                </div>
              ) : null}
              <form action={submitContact} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className="mb-1 block text-sm font-medium">
                    Your name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-name"
                    name="name"
                    required
                    maxLength={120}
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div>
                  <label htmlFor="c-business" className="mb-1 block text-sm font-medium">
                    Business name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-business"
                    name="businessName"
                    required
                    maxLength={200}
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="c-address" className="mb-1 block text-sm font-medium">
                    Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-address"
                    name="address"
                    required
                    maxLength={400}
                    placeholder="Street, city, state, zip"
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div>
                  <label htmlFor="c-phone" className="mb-1 block text-sm font-medium">
                    Phone number <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-phone"
                    name="phone"
                    type="tel"
                    required
                    maxLength={60}
                    autoComplete="tel"
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div>
                  <label htmlFor="c-email" className="mb-1 block text-sm font-medium">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-email"
                    name="email"
                    type="email"
                    required
                    maxLength={200}
                    autoComplete="email"
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div>
                  <label htmlFor="c-users" className="mb-1 block text-sm font-medium">
                    Number of users <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-users"
                    name="userCount"
                    type="number"
                    required
                    min={1}
                    max={100000}
                    placeholder="e.g. 25"
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div>
                  <label htmlFor="c-industry" className="mb-1 block text-sm font-medium">
                    Industry <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="c-industry"
                    name="industry"
                    required
                    defaultValue=""
                    className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    <option>Construction</option>
                    <option>Manufacturing</option>
                    <option>Oil &amp; gas</option>
                    <option>Utilities</option>
                    <option>Transportation &amp; logistics</option>
                    <option>Mining</option>
                    <option>Agriculture</option>
                    <option>Healthcare</option>
                    <option>Government / Municipal</option>
                    <option>Education</option>
                    <option>Retail / Hospitality</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="c-message" className="mb-1 block text-sm font-medium">
                    Anything else? (optional)
                  </label>
                  <textarea
                    id="c-message"
                    name="message"
                    maxLength={5000}
                    rows={4}
                    placeholder="Tell us about your safety program or what you'd like to learn more about."
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                <div className="md:col-span-2">
                  <SubmitButton pendingLabel="Sending…" className="h-11 px-6">
                    Send request
                  </SubmitButton>
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    We'll only use this info to follow up about getting your
                    organization set up.
                  </p>
                </div>
              </form>
            </div>
          )}
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

      <CookieConsent trackPath="/" />
    </div>
  );
}
