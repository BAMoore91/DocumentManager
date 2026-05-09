import { cn } from "@/lib/utils";
import type { CorrectiveActionPriority, CorrectiveActionStatus } from "@prisma/client";

const priorityStyles: Record<CorrectiveActionPriority, string> = {
  LOW: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const statusStyles: Record<CorrectiveActionStatus, string> = {
  OPEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  VERIFIED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  CLOSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const CAPA_PRIORITY_LABELS: Record<CorrectiveActionPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const CAPA_STATUS_LABELS: Record<CorrectiveActionStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  VERIFIED: "Verified",
  CLOSED: "Closed",
};

export function CapaPriorityBadge({ priority }: { priority: CorrectiveActionPriority }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        priorityStyles[priority],
      )}
    >
      {CAPA_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CapaStatusBadge({ status }: { status: CorrectiveActionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {CAPA_STATUS_LABELS[status]}
    </span>
  );
}
