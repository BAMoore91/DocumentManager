"use client";

import { CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { usePwa } from "@/components/pwa-provider";
import { cn } from "@/lib/utils";

export function OnlineIndicator() {
  const { online, pendingCount, syncNow } = usePwa();

  if (online && pendingCount === 0) return null;

  if (!online) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200 print:hidden"
        title="You are offline. New submissions are saved locally and will upload when you're back online."
      >
        <CloudOff className="h-3.5 w-3.5" />
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
      </span>
    );
  }

  // Online with pending = sync in progress / available
  return (
    <button
      type="button"
      onClick={() => syncNow()}
      title="Upload now"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-200 print:hidden",
      )}
    >
      <CloudUpload className="h-3.5 w-3.5" />
      {pendingCount} pending
      <RefreshCw className="h-3 w-3 opacity-60" />
    </button>
  );
}
