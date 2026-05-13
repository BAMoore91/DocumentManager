import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { checkForNewerRevision } from "@/lib/ai/sds-search";
import { notifySdsNewVersion } from "@/lib/notifications";
import { recordAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseBatchSize(): number {
  const raw = process.env.SDS_CHECK_BATCH_SIZE;
  if (!raw) return 25;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(Math.trunc(n), 100);
}

function parseAgeYears(): number {
  const raw = process.env.SDS_AGE_STALE_YEARS;
  if (!raw) return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(Math.trunc(n), 20);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const batchSize = parseBatchSize();
  const ageYears = parseAgeYears();
  const ageCutoff = new Date();
  ageCutoff.setFullYear(ageCutoff.getFullYear() - ageYears);

  // Pick the oldest-checked (or never-checked) sheets that aren't already
  // flagged. Sheets without a revisionDate are deprioritized because we
  // have no baseline to compare against.
  const sheets = await prisma.sdsSheet.findMany({
    where: { isStale: false },
    orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  });

  const summary = {
    examined: sheets.length,
    flaggedAge: 0,
    flaggedNewer: 0,
    noNewer: 0,
    errors: 0,
    skippedNoApiKey: 0,
  };

  const aiAvailable = isAnthropicConfigured();

  for (const sheet of sheets) {
    // Always update lastCheckedAt so we round-robin.
    const now = new Date();
    const isOld =
      sheet.revisionDate !== null && sheet.revisionDate < ageCutoff;

    if (!aiAvailable) {
      // Without AI we can still flag old revisions on age alone.
      summary.skippedNoApiKey += 1;
      if (isOld) {
        await prisma.sdsSheet.update({
          where: { id: sheet.id },
          data: {
            lastCheckedAt: now,
            isStale: true,
            staleReason: "age",
          },
        });
        await prisma.sdsRevisionCheck.create({
          data: {
            sdsSheetId: sheet.id,
            status: "no-match",
            rationale: `Stored revision ${sheet.revisionDate?.toISOString().slice(0, 10)} is older than ${ageYears} years (heuristic; AI unavailable).`,
          },
        });
        await notifySdsNewVersion({
          organizationId: sheet.organizationId,
          sheetId: sheet.id,
          productName: sheet.productName,
          staleReason: "age",
        });
        await recordAction({
          organizationId: sheet.organizationId,
          userId: null,
          action: "sds.marked-stale",
          summary: `Flagged "${sheet.productName}" as stale (age, AI unavailable)`,
          entityType: "SdsSheet",
          entityId: sheet.id,
        });
        summary.flaggedAge += 1;
      } else {
        await prisma.sdsSheet.update({
          where: { id: sheet.id },
          data: { lastCheckedAt: now },
        });
      }
      continue;
    }

    try {
      const result = await checkForNewerRevision({
        productName: sheet.productName,
        manufacturer: sheet.manufacturer,
        casNumber: sheet.casNumber,
        currentRevisionDate: sheet.revisionDate,
      });

      if (result.status === "newer-found") {
        const foundDate = /^\d{4}-\d{2}-\d{2}$/.test(result.foundRevisionAt)
          ? new Date(result.foundRevisionAt)
          : null;
        await prisma.sdsSheet.update({
          where: { id: sheet.id },
          data: {
            lastCheckedAt: now,
            isStale: true,
            staleReason: "newer-revision-found",
            latestKnownSourceUrl: result.foundUrl,
            latestKnownRevisionAt: foundDate,
            latestKnownNotes: result.rationale,
          },
        });
        await prisma.sdsRevisionCheck.create({
          data: {
            sdsSheetId: sheet.id,
            status: "newer-found",
            foundUrl: result.foundUrl,
            foundRevisionAt: foundDate,
            confidence: result.confidence,
            rationale: result.rationale,
          },
        });
        await notifySdsNewVersion({
          organizationId: sheet.organizationId,
          sheetId: sheet.id,
          productName: sheet.productName,
          staleReason: "newer-revision-found",
          rationale: result.rationale,
        });
        await recordAction({
          organizationId: sheet.organizationId,
          userId: null,
          action: "sds.marked-stale",
          summary: `Flagged "${sheet.productName}" — newer manufacturer revision found`,
          entityType: "SdsSheet",
          entityId: sheet.id,
        });
        summary.flaggedNewer += 1;
      } else if (result.status === "no-newer") {
        await prisma.sdsRevisionCheck.create({
          data: {
            sdsSheetId: sheet.id,
            status: "no-newer",
            rationale: result.rationale,
          },
        });
        if (isOld) {
          await prisma.sdsSheet.update({
            where: { id: sheet.id },
            data: {
              lastCheckedAt: now,
              isStale: true,
              staleReason: "age",
            },
          });
          await notifySdsNewVersion({
            organizationId: sheet.organizationId,
            sheetId: sheet.id,
            productName: sheet.productName,
            staleReason: "age",
            rationale: `Stored revision is ${ageYears}+ years old; AI did not find a newer one.`,
          });
          await recordAction({
            organizationId: sheet.organizationId,
            userId: null,
            action: "sds.marked-stale",
            summary: `Flagged "${sheet.productName}" as stale (age)`,
            entityType: "SdsSheet",
            entityId: sheet.id,
          });
          summary.flaggedAge += 1;
        } else {
          await prisma.sdsSheet.update({
            where: { id: sheet.id },
            data: { lastCheckedAt: now },
          });
          summary.noNewer += 1;
        }
      } else {
        // "no-match" — couldn't find an SDS to compare against
        await prisma.sdsSheet.update({
          where: { id: sheet.id },
          data: { lastCheckedAt: now },
        });
        await prisma.sdsRevisionCheck.create({
          data: {
            sdsSheetId: sheet.id,
            status: "no-match",
            rationale: result.rationale,
          },
        });
        summary.noNewer += 1;
      }
    } catch (err) {
      summary.errors += 1;
      await prisma.sdsRevisionCheck.create({
        data: {
          sdsSheetId: sheet.id,
          status: "error",
          rationale: err instanceof Error ? err.message.slice(0, 500) : String(err),
        },
      });
      await prisma.sdsSheet.update({
        where: { id: sheet.id },
        data: { lastCheckedAt: now },
      });
    }
  }

  return NextResponse.json({ ok: true, summary });
}
