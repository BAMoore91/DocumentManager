import { cn } from "@/lib/utils";
import type { ExpirationStatus } from "@/lib/utils";

const statusStyles: Record<ExpirationStatus, string> = {
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  "expiring-30": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  "expiring-60": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "expiring-90": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  valid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const statusLabels: Record<ExpirationStatus, string> = {
  expired: "Expired",
  "expiring-30": "≤ 30 days",
  "expiring-60": "≤ 60 days",
  "expiring-90": "≤ 90 days",
  valid: "Valid",
};

export function StatusBadge({ status }: { status: ExpirationStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}
