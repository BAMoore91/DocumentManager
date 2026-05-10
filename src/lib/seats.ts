import { prisma } from "@/lib/db";

export type OrgSeatUsage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  isFull: boolean;
};

export async function getOrgSeatUsage(organizationId: string): Promise<OrgSeatUsage> {
  const [org, used] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { userLimit: true },
    }),
    prisma.user.count({
      where: { organizationId, archivedAt: null },
    }),
  ]);
  const limit = org?.userLimit ?? null;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const isFull = limit !== null && used >= limit;
  return { used, limit, remaining, isFull };
}
