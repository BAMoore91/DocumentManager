"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordAction } from "@/lib/audit-log";
import { fetchAndStorePdf, BlobIngestError } from "@/lib/blob-ingest";
import {
  AnthropicConfigError,
  isAnthropicConfigured,
} from "@/lib/ai/anthropic";
import { findSdsCandidates } from "@/lib/ai/sds-search";
import { extractSdsMetadata } from "@/lib/ai/sds-extract";

const MAX_BYTES = 15 * 1024 * 1024;

async function assertOrgAccess(role: string, sessionOrgId: string | null, orgId: string) {
  if (role === "ORG_ADMIN" && sessionOrgId !== orgId) throw new Error("Forbidden");
}

async function uploadSdsFile(file: File, organizationId: string) {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 15 MB limit");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("File storage is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const blob = await put(`sds/${organizationId}/${Date.now()}-${safeName}`, file, {
    access: "public",
    contentType: file.type || "application/pdf",
  });
  return {
    fileUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  };
}

const ghsCodes = new Set([
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

function parseStringArray(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(String(raw));
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    return [];
  }
}

function parseGhsPictograms(raw: FormDataEntryValue | null): string[] {
  return parseStringArray(raw).filter((code) => ghsCodes.has(code));
}

function parseSignalWord(raw: FormDataEntryValue | null): string | null {
  const v = (raw ? String(raw) : "").trim();
  if (v === "Danger" || v === "Warning") return v;
  return null;
}

const createSchema = z.object({
  productName: z.string().trim().min(1).max(200),
  manufacturer: z.string().max(200).optional().nullable(),
  casNumber: z.string().max(60).optional().nullable(),
  revisionDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function createSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  if (!session.user.organizationId && session.user.role !== "SUPER_ADMIN") {
    throw new Error("No organization");
  }

  const parsed = createSchema.safeParse({
    productName: formData.get("productName"),
    manufacturer: formData.get("manufacturer") || null,
    casNumber: formData.get("casNumber") || null,
    revisionDate: formData.get("revisionDate") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Product name is required");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Upload an SDS file");

  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization");

  const fileFields = await uploadSdsFile(file, orgId);

  const created = await prisma.sdsSheet.create({
    data: {
      productName: parsed.data.productName,
      manufacturer: parsed.data.manufacturer ?? null,
      casNumber: parsed.data.casNumber ?? null,
      revisionDate: parsed.data.revisionDate ? new Date(parsed.data.revisionDate) : null,
      notes: parsed.data.notes ?? null,
      organizationId: orgId,
      uploadedById: session.user.id,
      signalWord: parseSignalWord(formData.get("aiSignalWord")),
      ghsPictograms: parseGhsPictograms(formData.get("aiGhsPictograms")),
      hazardStatements: parseStringArray(formData.get("aiHazardStatements")),
      ...fileFields,
    },
    select: { id: true },
  });

  await recordAction({
    organizationId: orgId,
    userId: session.user.id,
    action: "sds.upload",
    summary: `Uploaded SDS "${parsed.data.productName}"`,
    entityType: "SdsSheet",
    entityId: created.id,
  });

  revalidatePath("/sds");
  redirect(`/sds/${created.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  productName: z.string().trim().min(1).max(200),
  manufacturer: z.string().max(200).optional().nullable(),
  casNumber: z.string().max(60).optional().nullable(),
  revisionDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function updateSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    productName: formData.get("productName"),
    manufacturer: formData.get("manufacturer") || null,
    casNumber: formData.get("casNumber") || null,
    revisionDate: formData.get("revisionDate") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id: parsed.data.id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  let fileFields: Awaited<ReturnType<typeof uploadSdsFile>> | null = null;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    if (sheet.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(sheet.fileUrl);
      } catch {
        // ignore blob delete errors
      }
    }
    fileFields = await uploadSdsFile(file, sheet.organizationId);
  }

  await prisma.sdsSheet.update({
    where: { id: sheet.id },
    data: {
      productName: parsed.data.productName,
      manufacturer: parsed.data.manufacturer ?? null,
      casNumber: parsed.data.casNumber ?? null,
      revisionDate: parsed.data.revisionDate ? new Date(parsed.data.revisionDate) : null,
      notes: parsed.data.notes ?? null,
      ...(fileFields ?? {}),
    },
  });

  await recordAction({
    organizationId: sheet.organizationId,
    userId: session.user.id,
    action: "sds.update",
    summary: `Edited SDS "${parsed.data.productName}"`,
    entityType: "SdsSheet",
    entityId: sheet.id,
  });

  revalidatePath("/sds");
  revalidatePath(`/sds/${sheet.id}`);
}

export async function deleteSdsSheet(formData: FormData): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ORG_ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  if (sheet.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(sheet.fileUrl);
    } catch {
      // ignore blob delete errors
    }
  }

  await prisma.sdsSheet.delete({ where: { id } });

  await recordAction({
    organizationId: sheet.organizationId,
    userId: session.user.id,
    action: "sds.delete",
    summary: `Deleted SDS "${sheet.productName}"`,
    entityType: "SdsSheet",
    entityId: sheet.id,
  });

  revalidatePath("/sds");
  redirect("/sds");
}

// ---------- AI: find candidates -----------------------------------------

export type SdsCandidate = {
  title: string;
  sourceUrl: string;
  manufacturer?: string | null;
  revisionDate?: string | null;
  confidence?: number | null;
  rationale?: string | null;
};

export async function findSdsCandidatesAction(input: {
  product: string;
  manufacturer?: string;
  casNumber?: string;
}): Promise<
  | { ok: true; candidates: SdsCandidate[] }
  | { ok: false; error: string }
> {
  const session = await requireRole("ORG_ADMIN");
  if (!session.user.organizationId) {
    return { ok: false, error: "No organization" };
  }
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "AI search is not configured on this server" };
  }
  const product = input.product.trim();
  if (!product) return { ok: false, error: "Product name is required" };

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.auditLog.count({
    where: {
      organizationId: session.user.organizationId,
      action: "sds.ai-search",
      createdAt: { gte: since },
    },
  });
  if (recent >= 10) {
    return {
      ok: false,
      error: "Rate limit reached for AI SDS lookups (10/hour). Try again later.",
    };
  }

  try {
    const candidates = await findSdsCandidates({
      product,
      manufacturer: input.manufacturer?.trim() || undefined,
      casNumber: input.casNumber?.trim() || undefined,
    });

    await recordAction({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "sds.ai-search",
      summary: `AI search for "${product}" returned ${candidates.length} candidate(s)`,
    });

    return { ok: true, candidates };
  } catch (err) {
    if (err instanceof AnthropicConfigError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI search failed",
    };
  }
}

// ---------- AI: apply a candidate (fetch + create SdsSheet) -------------

const applyCandidateSchema = z.object({
  sourceUrl: z.string().url(),
  productName: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(200).optional().nullable(),
  casNumber: z.string().trim().max(60).optional().nullable(),
  revisionDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function applySdsCandidateAction(
  input: z.infer<typeof applyCandidateSchema>,
): Promise<{ ok: true; sheetId: string } | { ok: false; error: string }> {
  const session = await requireRole("ORG_ADMIN");
  if (!session.user.organizationId) {
    return { ok: false, error: "No organization" };
  }
  const orgId = session.user.organizationId;

  const parsed = applyCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid candidate data" };
  }

  let ingested;
  try {
    ingested = await fetchAndStorePdf({
      url: parsed.data.sourceUrl,
      blobPathPrefix: `sds/${orgId}`,
    });
  } catch (err) {
    if (err instanceof BlobIngestError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to fetch SDS",
    };
  }

  // Best-effort AI extraction; if it fails the upload still succeeds.
  let aiSignalWord: string | null = null;
  let aiGhs: string[] = [];
  let aiHazards: string[] = [];
  let revisionDateIso = parsed.data.revisionDate ?? null;
  if (isAnthropicConfigured()) {
    try {
      const res = await fetch(ingested.blobUrl);
      const bytes = Buffer.from(await res.arrayBuffer());
      const meta = await extractSdsMetadata(bytes);
      if (meta.signalWord === "Danger" || meta.signalWord === "Warning") {
        aiSignalWord = meta.signalWord;
      }
      if (meta.ghsPictograms) aiGhs = meta.ghsPictograms;
      if (meta.hazardStatements) aiHazards = meta.hazardStatements;
      if (!revisionDateIso && meta.revisionDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(meta.revisionDate)) {
          revisionDateIso = meta.revisionDate;
        }
      }
    } catch {
      // extraction is best-effort
    }
  }

  const created = await prisma.sdsSheet.create({
    data: {
      productName: parsed.data.productName,
      manufacturer: parsed.data.manufacturer ?? null,
      casNumber: parsed.data.casNumber ?? null,
      revisionDate: revisionDateIso ? new Date(revisionDateIso) : null,
      notes: parsed.data.notes ?? null,
      organizationId: orgId,
      uploadedById: session.user.id,
      signalWord: aiSignalWord,
      ghsPictograms: aiGhs,
      hazardStatements: aiHazards,
      sourceUrl: parsed.data.sourceUrl,
      fileUrl: ingested.blobUrl,
      fileName: ingested.fileName,
      fileSize: ingested.fileSize,
      mimeType: ingested.mimeType,
    },
    select: { id: true },
  });

  await recordAction({
    organizationId: orgId,
    userId: session.user.id,
    action: "sds.ai-imported",
    summary: `AI-imported SDS "${parsed.data.productName}" from ${new URL(parsed.data.sourceUrl).host}`,
    entityType: "SdsSheet",
    entityId: created.id,
  });

  revalidatePath("/sds");
  return { ok: true, sheetId: created.id };
}

// ---------- AI: stale flag actions --------------------------------------

export async function applyRevisionUpdateAction(formData: FormData): Promise<void> {
  const session = await requireRole("ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  if (!sheet.latestKnownSourceUrl) {
    throw new Error("No pending newer revision is recorded");
  }

  let ingested;
  try {
    ingested = await fetchAndStorePdf({
      url: sheet.latestKnownSourceUrl,
      blobPathPrefix: `sds/${sheet.organizationId}`,
    });
  } catch (err) {
    if (err instanceof BlobIngestError) {
      throw new Error(err.message);
    }
    throw err;
  }

  if (sheet.fileUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(sheet.fileUrl);
    } catch {
      // ignore blob delete errors
    }
  }

  await prisma.sdsSheet.update({
    where: { id: sheet.id },
    data: {
      fileUrl: ingested.blobUrl,
      fileName: ingested.fileName,
      fileSize: ingested.fileSize,
      mimeType: ingested.mimeType,
      sourceUrl: sheet.latestKnownSourceUrl,
      revisionDate: sheet.latestKnownRevisionAt ?? sheet.revisionDate,
      isStale: false,
      staleReason: null,
      latestKnownSourceUrl: null,
      latestKnownRevisionAt: null,
      latestKnownNotes: null,
      lastCheckedAt: new Date(),
    },
  });

  await recordAction({
    organizationId: sheet.organizationId,
    userId: session.user.id,
    action: "sds.auto-refresh",
    summary: `Replaced SDS "${sheet.productName}" with newer revision`,
    entityType: "SdsSheet",
    entityId: sheet.id,
  });

  revalidatePath("/sds");
  revalidatePath(`/sds/${sheet.id}`);
}

export async function dismissSdsStaleFlagAction(formData: FormData): Promise<void> {
  const session = await requireRole("ORG_ADMIN");
  if (!session.user.organizationId) throw new Error("No organization");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const sheet = await prisma.sdsSheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Not found");
  await assertOrgAccess(session.user.role, session.user.organizationId, sheet.organizationId);

  await prisma.sdsSheet.update({
    where: { id: sheet.id },
    data: {
      isStale: false,
      staleReason: null,
      latestKnownSourceUrl: null,
      latestKnownRevisionAt: null,
      latestKnownNotes: null,
    },
  });

  await recordAction({
    organizationId: sheet.organizationId,
    userId: session.user.id,
    action: "sds.stale-dismissed",
    summary: `Dismissed stale flag on SDS "${sheet.productName}"`,
    entityType: "SdsSheet",
    entityId: sheet.id,
  });

  revalidatePath("/sds");
  revalidatePath(`/sds/${sheet.id}`);
}
