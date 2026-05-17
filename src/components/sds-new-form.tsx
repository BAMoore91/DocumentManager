"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Sparkles, Loader2, Beaker } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createSdsSheet } from "@/lib/actions/sds";

type ExtractedMetadata = {
  productName?: string | null;
  manufacturer?: string | null;
  casNumber?: string | null;
  revisionDate?: string | null;
  signalWord?: "Danger" | "Warning" | null;
  ghsPictograms?: string[];
  hazardStatements?: string[];
};

type PubChemHazard = {
  pubchemCid: number;
  canonicalName: string | null;
  casNumber: string | null;
  signalWord: "Danger" | "Warning" | null;
  ghsPictograms: string[];
  hazardStatements: string[];
  sourceUrl: string;
};

type PubChemState =
  | { status: "idle" }
  | { status: "looking" }
  | { status: "hit"; hazard: PubChemHazard }
  | { status: "miss" };

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

export function SdsNewForm({ aiEnabled }: { aiEnabled: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [productName, setProductName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [revisionDate, setRevisionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [aiSignalWord, setAiSignalWord] = useState<string>("");
  const [aiGhs, setAiGhs] = useState<string[]>([]);
  const [aiHazards, setAiHazards] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);
  const [pubchem, setPubchem] = useState<PubChemState>({ status: "idle" });

  const lastLookupKey = useRef<string>("");

  // Debounced PubChem lookup whenever the CAS or product name settles.
  useEffect(() => {
    const cas = casNumber.trim();
    const name = productName.trim();
    const key = `${cas}|${name}`;
    if (!cas && name.length < 3) {
      setPubchem({ status: "idle" });
      lastLookupKey.current = "";
      return;
    }
    if (cas && !CAS_RE.test(cas) && name.length < 3) {
      setPubchem({ status: "idle" });
      return;
    }
    if (key === lastLookupKey.current) return;
    const handle = window.setTimeout(async () => {
      lastLookupKey.current = key;
      setPubchem({ status: "looking" });
      try {
        const res = await fetch("/api/sds/pubchem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cas: cas || undefined, name: name || undefined }),
        });
        const json: { ok: boolean; hazard?: PubChemHazard | null } =
          await res.json();
        if (!json.ok || !json.hazard) {
          setPubchem({ status: "miss" });
          return;
        }
        const h = json.hazard;
        setPubchem({ status: "hit", hazard: h });
        if (!productName && h.canonicalName) setProductName(h.canonicalName);
        if (!casNumber && h.casNumber) setCasNumber(h.casNumber);
        if (h.signalWord && !aiSignalWord) setAiSignalWord(h.signalWord);
        if (h.ghsPictograms.length && aiGhs.length === 0) setAiGhs(h.ghsPictograms);
        if (h.hazardStatements.length && aiHazards.length === 0) {
          setAiHazards(h.hazardStatements);
        }
      } catch {
        setPubchem({ status: "miss" });
      }
    }, 700);
    return () => window.clearTimeout(handle);
    // intentionally narrow deps; we only want to refire on the typed values
    // settling, not on cascading auto-fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casNumber, productName]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setExtractError(null);
    setExtractedSummary(null);
    const file = e.target.files?.[0];
    if (!file || !aiEnabled) return;
    if (!file.type.toLowerCase().includes("pdf")) return;

    setExtracting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/sds/extract", { method: "POST", body });
      const json: { ok: boolean; metadata?: ExtractedMetadata; error?: string } =
        await res.json();
      if (!json.ok || !json.metadata) {
        setExtractError(json.error ?? "Extraction failed");
        return;
      }
      const m = json.metadata;
      if (m.productName && !productName) setProductName(m.productName);
      if (m.manufacturer && !manufacturer) setManufacturer(m.manufacturer);
      if (m.casNumber && !casNumber) setCasNumber(m.casNumber);
      if (m.revisionDate && !revisionDate) {
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(m.revisionDate)
          ? m.revisionDate
          : "";
        if (iso) setRevisionDate(iso);
      }
      // Haiku's PDF read wins over PubChem when both are present — the actual
      // document is more authoritative for the specific product variant.
      if (m.signalWord === "Danger" || m.signalWord === "Warning") {
        setAiSignalWord(m.signalWord);
      }
      if (m.ghsPictograms?.length) setAiGhs(m.ghsPictograms);
      if (m.hazardStatements?.length) setAiHazards(m.hazardStatements);
      const summaryParts: string[] = [];
      if (m.signalWord) summaryParts.push(`Signal word: ${m.signalWord}`);
      if (m.ghsPictograms?.length)
        summaryParts.push(`GHS: ${m.ghsPictograms.join(", ")}`);
      if (m.hazardStatements?.length)
        summaryParts.push(`H-codes: ${m.hazardStatements.join(", ")}`);
      setExtractedSummary(
        summaryParts.length > 0
          ? summaryParts.join(" · ")
          : "AI scanned the file but couldn't read structured hazard data.",
      );
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={createSdsSheet}
      encType="multipart/form-data"
      className="space-y-3"
    >
      <input type="hidden" name="aiSignalWord" value={aiSignalWord} readOnly />
      <input
        type="hidden"
        name="aiGhsPictograms"
        value={JSON.stringify(aiGhs)}
        readOnly
      />
      <input
        type="hidden"
        name="aiHazardStatements"
        value={JSON.stringify(aiHazards)}
        readOnly
      />
      <div>
        <Label htmlFor="productName">Product / chemical name</Label>
        <Input
          id="productName"
          name="productName"
          required
          maxLength={200}
          placeholder="Acetone"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="manufacturer">Manufacturer (optional)</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            maxLength={200}
            placeholder="3M"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="casNumber">CAS number (optional)</Label>
          <Input
            id="casNumber"
            name="casNumber"
            maxLength={60}
            placeholder="67-64-1"
            value={casNumber}
            onChange={(e) => setCasNumber(e.target.value)}
          />
          <PubChemBadge state={pubchem} />
        </div>
      </div>
      <div>
        <Label htmlFor="revisionDate">Revision date (optional)</Label>
        <Input
          id="revisionDate"
          name="revisionDate"
          type="date"
          value={revisionDate}
          onChange={(e) => setRevisionDate(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={5000}
          placeholder="Hazard class, where it's used, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="file">SDS file (PDF preferred, max 15 MB)</Label>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/*,.doc,.docx"
          onChange={handleFileChange}
        />
        {aiEnabled ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            {extracting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Reading the PDF — fields will auto-fill in a moment…
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                AI will scan the PDF and pre-fill product, manufacturer, CAS,
                revision date, and hazard data when you pick a file.
              </>
            )}
          </p>
        ) : null}
        {extractError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-300">
            {extractError}
          </p>
        ) : null}
        {extractedSummary ? (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            {extractedSummary}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Uploading…">Upload SDS</SubmitButton>
    </form>
  );
}

function PubChemBadge({ state }: { state: PubChemState }) {
  if (state.status === "idle") return null;
  if (state.status === "looking") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Looking up in PubChem…
      </p>
    );
  }
  if (state.status === "miss") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Beaker className="h-3 w-3" />
        No PubChem match — that's fine, the form still works.
      </p>
    );
  }
  const h = state.hazard;
  const parts: string[] = [];
  if (h.signalWord) parts.push(h.signalWord);
  if (h.ghsPictograms.length) parts.push(h.ghsPictograms.join(" "));
  if (h.hazardStatements.length) parts.push(h.hazardStatements.join(" "));
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
      <Beaker className="h-3 w-3" />
      <a
        href={h.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="hover:underline"
      >
        PubChem ✓ {h.canonicalName ?? "match"}
      </a>
      {parts.length > 0 ? (
        <span className="text-[hsl(var(--muted-foreground))]">
          · {parts.join(" · ")}
        </span>
      ) : null}
    </p>
  );
}
