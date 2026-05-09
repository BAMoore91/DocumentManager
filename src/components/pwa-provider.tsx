"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { drainQueue, listQueued } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "danger";

type Toast = { id: number; message: string; tone: ToastTone };

type PwaContextType = {
  online: boolean;
  pendingCount: number;
  refreshPending: () => Promise<void>;
  syncNow: () => Promise<void>;
  showToast: (message: string, tone?: ToastTone) => void;
};

const PwaContext = createContext<PwaContextType | null>(null);

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) {
    throw new Error("usePwa must be called inside <PwaProvider>");
  }
  return ctx;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const syncing = useRef(false);
  const router = useRouter();

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Track network state
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const items = await listQueued();
      setPendingCount(items.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current) return;
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    syncing.current = true;
    try {
      const result = await drainQueue(async (item) => {
        try {
          const res = await fetch(item.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
            credentials: "same-origin",
          });
          return res.ok;
        } catch {
          return false;
        }
      });
      await refreshPending();
      if (result.synced > 0) {
        showToast(
          `${result.synced} offline ${result.synced === 1 ? "submission" : "submissions"} uploaded`,
          "success",
        );
        router.refresh();
      }
      if (result.failed > 0) {
        showToast(
          `${result.failed} item${result.failed === 1 ? "" : "s"} couldn't sync — will retry`,
          "danger",
        );
      }
    } finally {
      syncing.current = false;
    }
  }, [refreshPending, router, showToast]);

  // Auto-sync when we come back online
  useEffect(() => {
    if (online && pendingCount > 0) {
      syncNow();
    }
  }, [online, pendingCount, syncNow]);

  return (
    <PwaContext.Provider
      value={{ online, pendingCount, refreshPending, syncNow, showToast }}
    >
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 print:hidden"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg",
              t.tone === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-100",
              t.tone === "danger" &&
                "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950 dark:text-red-100",
              t.tone === "info" &&
                "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </PwaContext.Provider>
  );
}
