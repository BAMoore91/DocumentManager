import { z } from "zod";
import { getAnthropicClient } from "./anthropic";

const ghsCodes = [
  "GHS01",
  "GHS02",
  "GHS03",
  "GHS04",
  "GHS05",
  "GHS06",
  "GHS07",
  "GHS08",
  "GHS09",
] as const;

const metadataSchema = z.object({
  productName: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  casNumber: z.string().nullable().optional(),
  revisionDate: z.string().nullable().optional(),
  signalWord: z.enum(["Danger", "Warning"]).nullable().optional(),
  ghsPictograms: z.array(z.enum(ghsCodes)).max(9).optional(),
  hazardStatements: z.array(z.string()).max(40).optional(),
});

export type ExtractedSdsMetadata = z.infer<typeof metadataSchema>;

const schemaDescription = `
{
  "productName": "exact product / chemical name as printed on Section 1, or null",
  "manufacturer": "company name on Section 1 'Supplier/Manufacturer', or null",
  "casNumber": "primary CAS number from Section 3 (single substance) or the most prominent one, or null",
  "revisionDate": "ISO date YYYY-MM-DD from Section 16 'Date of issue/Revision', or null",
  "signalWord": "Danger | Warning | null",
  "ghsPictograms": ["GHS01"..."GHS09" codes you can clearly identify from Section 2"],
  "hazardStatements": ["H225", "H319", ...] — only H-codes you can clearly read from Section 2
}
Return ONLY the JSON object. Use null for unknown fields. Never invent values.
`.trim();

const FENCE_RE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

function extractJsonString(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(FENCE_RE);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1) return trimmed;
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBrace <= firstBrace) return trimmed;
  return trimmed.slice(firstBrace, lastBrace + 1);
}

export async function extractSdsMetadata(
  pdfBytes: Buffer,
): Promise<ExtractedSdsMetadata> {
  const client = getAnthropicClient();
  const base64 = pdfBytes.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: `You extract structured metadata from Safety Data Sheets (SDS / MSDS). Read the document carefully. Never invent values — if a field is unclear, return null.

Schema:
${schemaDescription}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract the metadata from this SDS as a single JSON object matching the schema. Return ONLY the JSON.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned no text content from PDF extraction");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonString(text));
  } catch {
    throw new Error(
      `Extraction returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }

  return metadataSchema.parse(parsed);
}
