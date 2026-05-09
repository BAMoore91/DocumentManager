import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type RecordArgs = {
  organizationId: string | null | undefined;
  userId: string | null | undefined;
  action: string; // dotted name, e.g. "user.login", "document.upload"
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function getRequestContext() {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ipAddress = fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
    const userAgent = h.get("user-agent");
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null as string | null, userAgent: null as string | null };
  }
}

export async function recordAction(args: RecordArgs): Promise<void> {
  if (!args.organizationId) return;
  const { ipAddress, userAgent } = await getRequestContext();
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId ?? null,
        action: args.action,
        summary: args.summary,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        metadata:
          args.metadata == null
            ? Prisma.JsonNull
            : (args.metadata as Prisma.InputJsonValue),
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging break the user-facing action.
    console.error("[audit] failed to record action", err);
  }
}
