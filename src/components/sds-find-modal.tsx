"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  X,
  ExternalLink,
  AlertTriangle,
  Beaker,
} from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  findSdsCandidatesAction,
  applySdsCandidateAction,
  createSdsSheet,
} from "@/lib/actions/sds";
import type { SdsCandidate } from "@/lib/ai/sds-search";
import type { PubChemHazardData } from "@/lib/pubchem";

type ApplyCandidateFallback = {
  sourceUrl: string;
  productName: string;
  manufacturer: string | null;
  casNumber: string | null;
  revisionDate: string | null;
  signalWord: "Danger" | "Warning" | null;
  ghsPictograms: string[];
  hazardStatements: string[];
};

type Phase =
  | { type: "idle" }
  | { type: "searching" }
  | {
      type: "results";
      candidates: SdsCandidate[];
      query: string;
      hazard: PubChemHazardData | null;
    }
  | { type: "handoff"; fallback: ApplyCandidateFallback }
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
    setPhase({
      type: "results",
      candidates: res.candidates,
      query: trimmed,
      hazard: res.hazard,
    });
  }

  async function onPick(candidate: SdsCandidate) {
    setApplyingUrl(candidate.sourceUrl);
    const hazard =
      phase.type === "results" && phase.hazard
        ? {
            signalWord: phase.hazard.signalWord,
            ghsPictograms: phase.hazard.ghsPictograms,
            hazardStatements: phase.hazard.hazardStatements,
          }
        : null;
    const res = await applySdsCandidateAction({
      sourceUrl: candidate.sourceUrl,
      productName: product.trim() || candidate.title || "Imported SDS",
      manufacturer: candidate.manufacturer ?? manufacturer.trim() ?? null,
      casNumber: casNumber.trim() || null,
      revisionDate: candidate.revisionDate ?? null,
      hazard,
    });
    setApplyingUrl(null);
    if (res.ok) {
      setOpen(false);
      reset();
      router.push(`/sds/${res.sheetId}`);
      router.refresh();
      return;
    }
    if (res.fallback) {
      setPhase({ type: "handoff", fallback: res.fallback });
      return;
    }
    setPhase({ type: "error", message: res.error });
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
                  manufacturer-published SDS PDFs. PubChem fills in hazard data
                  in parallel. Review results before importing.
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

            {phase.type === "handoff" ? (
              <ManualHandoff
                fallback={phase.fallback}
                onCancel={() => setPhase({ type: "idle" })}
              />
            ) : (
              <>
                <form
                  onSubmit={onSearch}
                  className="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
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
                    <Label htmlFor="find-manufacturer">
                      Manufacturer (optional)
                    </Label>
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
                      disabled={
                        phase.type === "searching" || applyingUrl !== null
                      }
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
                    {phase.hazard ? (
                      <HazardSummary hazard={phase.hazard} />
                    ) : null}
                    <div className="text-sm font-medium">
                      {phase.candidates.length === 0
                        ? `No SDS candidates found for "${phase.query}".`
                        : `${phase.candidates.length} candidate${phase.candidates.length === 1 ? "" : "s"} for "${phase.query}"`}
                    </div>
                    {phase.candidates.map((c) => (
                      <CandidateRow
                        key={c.sourceUrl}
                        candidate={c}
                        applyingUrl={applyingUrl}
                        onPick={onPick}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function HazardSummary({ hazard }: { hazard: PubChemHazardData }) {
  const parts: string[] = [];
  if (hazard.signalWord) parts.push(hazard.signalWord);
  if (hazard.ghsPictograms.length)
    parts.push(hazard.ghsPictograms.join(" "));
  if (hazard.hazardStatements.length)
    parts.push(hazard.hazardStatements.join(" "));
  return (
    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
      <div className="flex flex-wrap items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
        <Beaker className="h-3 w-3" />
        <a
          href={hazard.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium hover:underline"
        >
          PubChem: {hazard.canonicalName ?? "match"}
        </a>
        {hazard.casNumber ? (
          <span className="text-emerald-700/80 dark:text-emerald-300/80">
            · CAS {hazard.casNumber}
          </span>
        ) : null}
      </div>
      {parts.length > 0 ? (
        <div className="mt-1 text-emerald-700 dark:text-emerald-300">
          {parts.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  applyingUrl,
  onPick,
}: {
  candidate: SdsCandidate;
  applyingUrl: string | null;
  onPick: (c: SdsCandidate) => void;
}) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{candidate.title}</span>
            {typeof candidate.confidence === "number" ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  candidate.confidence >= 0.75
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : candidate.confidence >= 0.45
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                )}
              >
                {Math.round(candidate.confidence * 100)}% confidence
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {candidate.manufacturer ?? "Manufacturer unknown"}
            {candidate.revisionDate
              ? ` · Revision ${candidate.revisionDate}`
              : ""}
          </div>
          {candidate.rationale ? (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {candidate.rationale}
            </p>
          ) : null}
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 break-all text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {(() => {
              try {
                return new URL(candidate.sourceUrl).host;
              } catch {
                return candidate.sourceUrl;
              }
            })()}
          </a>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onPick(candidate)}
          disabled={applyingUrl !== null}
        >
          {applyingUrl === candidate.sourceUrl ? (
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
  );
}

function ManualHandoff({
  fallback,
  onCancel,
}: {
  fallback: ApplyCandidateFallback;
  onCancel: () => void;
}) {
  const host = (() => {
    try {
      return new URL(fallback.sourceUrl).host;
    } catch {
      return fallback.sourceUrl;
    }
  })();
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <div className="flex items-start gap-2 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              Couldn't auto-download from {host}.
            </div>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Most manufacturer SDS hosts block server-side downloads. Open the
              SDS in a new tab, save the PDF locally, then attach it below.
              Everything else stays pre-filled.
            </p>
            <a
              href={fallback.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-8 items-center justify-center gap-2 rounded-md bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700"
            >
              <ExternalLink className="h-3 w-3" />
              Open SDS in new tab
            </a>
          </div>
        </div>
      </div>
      <form
        action={createSdsSheet}
        encType="multipart/form-data"
        className="space-y-3"
      >
        <input type="hidden" name="manualHandoff" value="1" />
        <input type="hidden" name="sourceUrl" value={fallback.sourceUrl} />
        <input
          type="hidden"
          name="aiSignalWord"
          value={fallback.signalWord ?? ""}
        />
        <input
          type="hidden"
          name="aiGhsPictograms"
          value={JSON.stringify(fallback.ghsPictograms)}
        />
        <input
          type="hidden"
          name="aiHazardStatements"
          value={JSON.stringify(fallback.hazardStatements)}
        />
        <div>
          <Label htmlFor="handoff-product">Product / chemical name</Label>
          <Input
            id="handoff-product"
            name="productName"
            required
            maxLength={200}
            defaultValue={fallback.productName}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="handoff-manufacturer">Manufacturer</Label>
            <Input
              id="handoff-manufacturer"
              name="manufacturer"
              maxLength={200}
              defaultValue={fallback.manufacturer ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="handoff-cas">CAS number</Label>
            <Input
              id="handoff-cas"
              name="casNumber"
              maxLength={60}
              defaultValue={fallback.casNumber ?? ""}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="handoff-revision">Revision date</Label>
          <Input
            id="handoff-revision"
            name="revisionDate"
            type="date"
            defaultValue={fallback.revisionDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="handoff-notes">Notes (optional)</Label>
          <Textarea id="handoff-notes" name="notes" maxLength={5000} />
        </div>
        <div>
          <Label htmlFor="handoff-file">
            SDS file you downloaded (PDF, max 15 MB)
          </Label>
          <Input
            id="handoff-file"
            name="file"
            type="file"
            required
            accept="application/pdf,image/*,.doc,.docx"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Uploading…">Upload SDS</SubmitButton>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Back to results
          </Button>
        </div>
      </form>
    </div>
  );
}
