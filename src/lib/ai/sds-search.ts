import { z } from "zod";
import { callClaudeWebSearch } from "./anthropic";

const candidateSchema = z.object({
  title: z.string(),
  sourceUrl: z.string().url(),
  manufacturer: z.string().nullable().optional(),
  revisionDate: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  rationale: z.string().nullable().optional(),
});

const candidatesSchema = z.object({
  candidates: z.array(candidateSchema).max(8),
});

export type SdsCandidate = z.infer<typeof candidateSchema>;

const candidatesSchemaDescription = `
{
  "candidates": [
    {
      "title": "string — short label combining product and manufacturer",
      "sourceUrl": "string (HTTPS URL pointing directly to the manufacturer-hosted SDS PDF)",
      "manufacturer": "string or null",
      "revisionDate": "string (ISO 8601 YYYY-MM-DD) or null if unknown",
      "confidence": "number 0..1 — 1 means definitely the manufacturer's current SDS for this exact product",
      "rationale": "string — one sentence explaining why this is a good candidate"
    }
  ]
}
Constraints:
- Return at most 5 candidates, ordered best-first.
- Prefer URLs that end in .pdf and are hosted on the manufacturer's domain.
- If you cannot find any plausible SDS, return {"candidates": []}.
`.trim();

export async function findSdsCandidates(args: {
  product: string;
  manufacturer?: string;
  casNumber?: string;
}): Promise<SdsCandidate[]> {
  const lines = [
    `Find the current manufacturer Safety Data Sheet (SDS) for: ${args.product}.`,
  ];
  if (args.manufacturer) lines.push(`Manufacturer: ${args.manufacturer}.`);
  if (args.casNumber) lines.push(`CAS number: ${args.casNumber}.`);
  lines.push(
    "Look on the manufacturer's own website first. Avoid resellers, aggregators, and generic chemical databases. Prefer the most recent revision.",
  );

  const result = await callClaudeWebSearch({
    system:
      "You are a safety-compliance research assistant. Your job is to locate authoritative manufacturer-hosted Safety Data Sheet PDFs.",
    userPrompt: lines.join(" "),
    schema: candidatesSchema,
    schemaDescription: candidatesSchemaDescription,
    maxUses: 5,
    maxTokens: 4096,
  });

  return result.candidates;
}

const newerRevisionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("no-newer"),
    rationale: z.string().optional(),
  }),
  z.object({
    status: z.literal("newer-found"),
    foundUrl: z.string().url(),
    foundRevisionAt: z.string(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  }),
  z.object({
    status: z.literal("no-match"),
    rationale: z.string().optional(),
  }),
]);

export type NewerRevisionResult = z.infer<typeof newerRevisionSchema>;

const newerRevisionSchemaDescription = `
Reply with exactly one of these shapes:
{ "status": "newer-found", "foundUrl": "<HTTPS URL to manufacturer PDF>", "foundRevisionAt": "YYYY-MM-DD", "confidence": 0..1, "rationale": "one sentence" }
{ "status": "no-newer", "rationale": "one sentence" }
{ "status": "no-match", "rationale": "one sentence — could not find a current SDS for this product" }
`.trim();

export async function checkForNewerRevision(args: {
  productName: string;
  manufacturer?: string | null;
  casNumber?: string | null;
  currentRevisionDate?: Date | null;
}): Promise<NewerRevisionResult> {
  const currentIso = args.currentRevisionDate
    ? args.currentRevisionDate.toISOString().slice(0, 10)
    : null;

  const lines = [
    `We have an SDS on file for: ${args.productName}.`,
    args.manufacturer ? `Manufacturer: ${args.manufacturer}.` : "",
    args.casNumber ? `CAS number: ${args.casNumber}.` : "",
    currentIso
      ? `Our stored revision date is ${currentIso}. Is there a newer manufacturer revision available?`
      : `We do not know the current revision date. Find the latest manufacturer revision.`,
    "Only flag a newer revision if you can point to a manufacturer-hosted PDF and read a revision date from it. Do not invent dates.",
  ].filter(Boolean);

  return await callClaudeWebSearch({
    system:
      "You are a safety-compliance research assistant verifying whether stored Safety Data Sheets are out of date. Be conservative — when uncertain, return no-newer.",
    userPrompt: lines.join(" "),
    schema: newerRevisionSchema,
    schemaDescription: newerRevisionSchemaDescription,
    maxUses: 4,
    maxTokens: 2048,
  });
}
