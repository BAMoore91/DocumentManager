"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function FormModal({
  triggerLabel,
  triggerIcon = "plus",
  triggerVariant = "primary",
  title,
  description,
  children,
  size = "md",
}: {
  triggerLabel: string;
  triggerIcon?: "plus" | "none";
  triggerVariant?: "primary" | "secondary";
  title: string;
  description?: string;
  children: ReactNode;
  size?: Size;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition print:hidden",
          triggerVariant === "primary"
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
            : "border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
        )}
      >
        {triggerIcon === "plus" ? <Plus className="h-4 w-4" /> : null}
        {triggerLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={cn(
              "relative my-8 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg",
              sizes[size],
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {description ? (
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              onSubmitCapture={() => {
                // Close on submit; if the action throws, Next's error
                // boundary takes over the page anyway.
                setTimeout(() => setOpen(false), 0);
              }}
            >
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
