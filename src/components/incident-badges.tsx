import { cn } from "@/lib/utils";
import type { IncidentStatus, IncidentType } from "@prisma/client";

const typeStyles: Record<IncidentType, string> = {
  NEAR_MISS: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  FIRST_AID: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  RECORDABLE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  RESTRICTED_DUTY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  LOST_TIME: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  FATALITY: "bg-black text-white dark:bg-red-950 dark:text-red-200",
};

export const TYPE_LABELS: Record<IncidentType, string> = {
  NEAR_MISS: "Near miss",
  FIRST_AID: "First aid",
  RECORDABLE: "Recordable",
  RESTRICTED_DUTY: "Restricted duty",
  LOST_TIME: "Lost time",
  FATALITY: "Fatality",
};

const statusStyles: Record<IncidentStatus, string> = {
  OPEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  CLOSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  CLOSED: "Closed",
};

export function IncidentTypeBadge({ type }: { type: IncidentType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        typeStyles[type],
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
