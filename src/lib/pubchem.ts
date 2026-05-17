import { z } from "zod";

const GHS_CODES = new Set([
  "GHS01",
  "GHS02",
  "GHS03",
  "GHS04",
  "GHS05",
  "GHS06",
  "GHS07",
  "GHS08",
  "GHS09",
]);

const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov";
const FETCH_TIMEOUT_MS = 8_000;

export type PubChemHazardData = {
  pubchemCid: number;
  canonicalName: string | null;
  casNumber: string | null;
  signalWord: "Danger" | "Warning" | null;
  ghsPictograms: string[];
  hazardStatements: string[];
  sourceUrl: string;
};

async function pubchemFetch(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PUBCHEM_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const cidsSchema = z.object({
  IdentifierList: z.object({ CID: z.array(z.number()) }).optional(),
});

async function resolveCid(query: string): Promise<number | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const encoded = encodeURIComponent(trimmed);
  const json = await pubchemFetch(
    `/rest/pug/compound/name/${encoded}/cids/JSON`,
  );
  if (!json) return null;
  const parsed = cidsSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data.IdentifierList?.CID?.[0] ?? null;
}

const propertySchema = z.object({
  PropertyTable: z
    .object({
      Properties: z
        .array(
          z.object({
            IUPACName: z.string().optional(),
            MolecularFormula: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

async function fetchProperties(
  cid: number,
): Promise<{ iupac: string | null }> {
  const json = await pubchemFetch(
    `/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula/JSON`,
  );
  if (!json) return { iupac: null };
  const parsed = propertySchema.safeParse(json);
  const props = parsed.success
    ? parsed.data.PropertyTable?.Properties?.[0]
    : undefined;
  return { iupac: props?.IUPACName ?? null };
}

const synonymsSchema = z.object({
  InformationList: z
    .object({
      Information: z
        .array(z.object({ Synonym: z.array(z.string()).optional() }))
        .optional(),
    })
    .optional(),
});

async function fetchSynonyms(cid: number): Promise<string[]> {
  const json = await pubchemFetch(
    `/rest/pug/compound/cid/${cid}/synonyms/JSON`,
  );
  if (!json) return [];
  const parsed = synonymsSchema.safeParse(json);
  return parsed.success
    ? (parsed.data.InformationList?.Information?.[0]?.Synonym ?? [])
    : [];
}

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

function pickCasFromSynonyms(synonyms: string[]): string | null {
  for (const s of synonyms) {
    if (CAS_RE.test(s)) return s;
  }
  return null;
}

function pickCanonicalName(
  synonyms: string[],
  iupac: string | null,
): string | null {
  // Prefer the first reasonably short non-CAS synonym; PubChem typically lists
  // the common name first. Fall back to IUPAC.
  for (const s of synonyms) {
    if (CAS_RE.test(s)) continue;
    if (s.length > 80) continue;
    return s;
  }
  return iupac;
}

// PUG-View structures use a recursive Section tree with TOCHeading labels.
type PugViewNode = {
  TOCHeading?: string;
  Section?: PugViewNode[];
  Information?: PugViewInfo[];
};

type PugViewInfo = {
  Name?: string;
  Value?: {
    StringWithMarkup?: Array<{ String?: string }>;
    Number?: number[];
  };
};

function findSectionByHeading(
  node: PugViewNode,
  heading: string,
): PugViewNode | null {
  if (!node) return null;
  if (node.TOCHeading === heading) return node;
  for (const child of node.Section ?? []) {
    const found = findSectionByHeading(child, heading);
    if (found) return found;
  }
  return null;
}

function collectStrings(infos: PugViewInfo[] | undefined): string[] {
  if (!infos) return [];
  const out: string[] = [];
  for (const info of infos) {
    for (const swm of info.Value?.StringWithMarkup ?? []) {
      if (swm.String) out.push(swm.String.trim());
    }
  }
  return out;
}

function parseSignalWord(text: string): "Danger" | "Warning" | null {
  const lower = text.toLowerCase();
  if (lower.includes("danger")) return "Danger";
  if (lower.includes("warning")) return "Warning";
  return null;
}

function parseGhsPictograms(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    const matches = t.match(/GHS0[1-9]/g);
    if (matches) {
      for (const m of matches) {
        if (GHS_CODES.has(m)) out.add(m);
      }
    }
  }
  return Array.from(out);
}

function parseHazardStatements(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    const matches = t.match(/H\d{3}[A-Z]?/g);
    if (matches) for (const m of matches) out.add(m);
  }
  return Array.from(out);
}

async function fetchGhsData(cid: number): Promise<{
  signalWord: "Danger" | "Warning" | null;
  ghsPictograms: string[];
  hazardStatements: string[];
}> {
  const empty = { signalWord: null, ghsPictograms: [], hazardStatements: [] };
  const json = (await pubchemFetch(
    `/rest/pug_view/data/compound/${cid}/JSON?heading=GHS+Classification`,
  )) as { Record?: PugViewNode } | null;
  if (!json?.Record) return empty;
  const ghsSection = findSectionByHeading(json.Record, "GHS Classification");
  if (!ghsSection) return empty;

  const signalSection =
    findSectionByHeading(ghsSection, "Signal") ??
    findSectionByHeading(ghsSection, "GHS Signal Word");
  const pictogramSection =
    findSectionByHeading(ghsSection, "Pictogram(s)") ??
    findSectionByHeading(ghsSection, "Pictogram") ??
    findSectionByHeading(ghsSection, "Pictograms");
  const hazardSection =
    findSectionByHeading(ghsSection, "GHS Hazard Statements") ??
    findSectionByHeading(ghsSection, "Hazard Statements");

  const signalText = collectStrings(signalSection?.Information).join(" ");
  const pictogramTexts = collectStrings(pictogramSection?.Information);
  const hazardTexts = collectStrings(hazardSection?.Information);

  return {
    signalWord: signalText ? parseSignalWord(signalText) : null,
    ghsPictograms: parseGhsPictograms(pictogramTexts),
    hazardStatements: parseHazardStatements(hazardTexts),
  };
}

async function buildHazardData(
  cid: number,
  knownCas: string | null,
): Promise<PubChemHazardData | null> {
  const [{ iupac }, synonyms, ghs] = await Promise.all([
    fetchProperties(cid),
    fetchSynonyms(cid),
    fetchGhsData(cid),
  ]);

  const cas = knownCas ?? pickCasFromSynonyms(synonyms);
  const canonicalName = pickCanonicalName(synonyms, iupac);

  // Treat a CID hit with zero hazard data as "still useful" — the canonical
  // name + CAS alone helps the upload form. But if we have literally nothing,
  // pretend we found nothing.
  if (
    !canonicalName &&
    !cas &&
    !ghs.signalWord &&
    ghs.ghsPictograms.length === 0 &&
    ghs.hazardStatements.length === 0
  ) {
    return null;
  }

  return {
    pubchemCid: cid,
    canonicalName,
    casNumber: cas,
    signalWord: ghs.signalWord,
    ghsPictograms: ghs.ghsPictograms,
    hazardStatements: ghs.hazardStatements,
    sourceUrl: `${PUBCHEM_BASE}/compound/${cid}`,
  };
}

export async function lookupByCas(
  cas: string,
): Promise<PubChemHazardData | null> {
  const trimmed = cas.trim();
  if (!CAS_RE.test(trimmed)) return null;
  const cid = await resolveCid(trimmed);
  if (!cid) return null;
  return buildHazardData(cid, trimmed);
}

export async function lookupByName(
  name: string,
): Promise<PubChemHazardData | null> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  const cid = await resolveCid(trimmed);
  if (!cid) return null;
  return buildHazardData(cid, null);
}

export async function lookupBest(args: {
  cas?: string | null;
  name?: string | null;
}): Promise<PubChemHazardData | null> {
  if (args.cas && args.cas.trim()) {
    const byCas = await lookupByCas(args.cas);
    if (byCas) return byCas;
  }
  if (args.name && args.name.trim()) {
    const byName = await lookupByName(args.name);
    if (byName) return byName;
  }
  return null;
}
