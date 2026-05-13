"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X, ExternalLink } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  findSdsCandidatesAction,
  applySdsCandidateAction,
} from "@/lib/actions/sds";
import type { SdsCandidate } from "@/lib/ai/sds-search";

type Phase =
  | { type: "idle" }
  | { type: "searching" }
  | { type: "results"; candidates: SdsCandidate[]; query: string }
  | { type: "error"; message: string };

export function SdsFindModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [applyingUrl, setApplyingUrl] = useState<string | null>(null);

  function reset() {
    setProduct("");
    setManufacturer("");
    setCasNumber("");
    setPhase({ type: "idle" });
    setApplyingUrl(null);
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = product.trim();
    if (!trimmed) return;
    setPhase({ type: "searching" });
    const res = await findSdsCandidatesAction({
      product: trimmed,
      manufacturer: manufacturer.trim() || undefined,
      casNumber: casNumber.trim() || undefined,
    });
    if (!res.ok) {
      setPhase({ type: "error", message: res.error });
      return;
    }
    setPhase({ type: "results", candidates: res.candidates, query: trimmed });
  }

  async function onPick(candidate: SdsCandidate) {
    setApplyingUrl(candidate.sourceUrl);
    const res = await applySdsCandidateAction({
      sourceUrl: candidate.sourceUrl,
      productName: product.trim() || candidate.title || "Imported SDS",
      manufacturer: candidate.manufacturer ?? manufacturer.trim() ?? null,
      casNumber: casNumber.trim() || null,
      revisionDate: candidate.revisionDate ?? null,
    });
    if (!res.ok) {
      setApplyingUrl(null);
      setPhase({ type: "error", message: res.error });
      return;
    }
    setOpen(false);
    reset();
    router.push(`/sds/${res.sheetId}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]"
      >
        <Sparkles className="h-4 w-4" />
        Find SDS
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative my-8 w-full max-w-2xl rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Find an SDS with AI</h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  Type a product or CAS number and we'll search for
                  manufacturer-published SDS PDFs. Review the results before
                  importing.
                </p>
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

            <form onSubmit={onSearch} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="find-product">Product / chemical name</Label>
                <Input
                  id="find-product"
                  required
                  maxLength={200}
                  placeholder="Acetone"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="find-manufacturer">Manufacturer (optional)</Label>
                <Input
                  id="find-manufacturer"
                  maxLength={200}
                  placeholder="Sigma-Aldrich"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="find-cas">CAS # (optional)</Label>
                <Input
                  id="find-cas"
                  maxLength={60}
                  placeholder="67-64-1"
                  value={casNumber}
                  onChange={(e) => setCasNumber(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={phase.type === "searching" || applyingUrl !== null}
                >
                  {phase.type === "searching" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </>
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </form>

            {phase.type === "error" ? (
              <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
                {phase.message}
              </p>
            ) : null}

            {phase.type === "results" ? (
              <div className="mt-5 space-y-2">
                <div className="text-sm font-medium">
                  {phase.candidates.length === 0
                    ? `No SDS candidates found for "${phase.query}".`
                    : `${phase.candidates.length} candidate${phase.candidates.length === 1 ? "" : "s"} for "${phase.query}"`}
                </div>
                {phase.candidates.map((c) => (
                  <div
                    key={c.sourceUrl}
                    className="rounded-md border border-[hsl(var(--border))] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.title}</span>
                          {typeof c.confidence === "number" ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                c.confidence >= 0.75
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                  : c.confidence >= 0.45
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                              )}
                            >
                              {Math.round(c.confidence * 100)}% confidence
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          {c.manufacturer ?? "Manufacturer unknown"}
                          {c.revisionDate ? ` · Revision ${c.revisionDate}` : ""}
                        </div>
                        {c.rationale ? (
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            {c.rationale}
                          </p>
                        ) : null}
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 break-all text-xs text-[hsl(var(--primary))] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {(() => {
                            try {
                              return new URL(c.sourceUrl).host;
                            } catch {
                              return c.sourceUrl;
                            }
                          })()}
                        </a>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onPick(c)}
                        disabled={applyingUrl !== null}
                      >
                        {applyingUrl === c.sourceUrl ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Importing…
                          </>
                        ) : (
                          "Import"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
