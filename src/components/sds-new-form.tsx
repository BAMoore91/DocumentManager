"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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
      if (m.signalWord === "Danger" || m.signalWord === "Warning") {
        setAiSignalWord(m.signalWord);
      }
      setAiGhs(m.ghsPictograms ?? []);
      setAiHazards(m.hazardStatements ?? []);
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
