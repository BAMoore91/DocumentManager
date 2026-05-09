import { cn } from "@/lib/utils";
import type { JhaSeverity, JhaStatus } from "@prisma/client";

const severityStyles: Record<JhaSeverity, string> = {
  LOW: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const severityLabels: Record<JhaSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const statusStyles: Record<JhaStatus, string> = {
  OPEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const statusLabels: Record<JhaStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export function SeverityBadge({ severity }: { severity: JhaSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        severityStyles[severity],
      )}
    >
      {severityLabels[severity]}
    </span>
  );
}

export function JhaStatusBadge({ status }: { status: JhaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
