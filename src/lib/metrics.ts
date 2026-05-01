import { prisma } from "@/lib/db";

export type ExpirationBuckets = {
  total: number;
  valid: number;
  expiring90: number;
  expiring60: number;
  expiring30: number;
  expired: number;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(days: number) {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  return d;
}

async function bucketsFor(where: Record<string, unknown>): Promise<ExpirationBuckets> {
  const today = startOfToday();
  const in30 = daysFromNow(30);
  const in60 = daysFromNow(60);
  const in90 = daysFromNow(90);

  const [total, expired, expiring30, expiring60, expiring90, valid] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.count({ where: { ...where, expirationDate: { lt: today } } }),
    prisma.document.count({ where: { ...where, expirationDate: { gte: today, lte: in30 } } }),
    prisma.document.count({ where: { ...where, expirationDate: { gte: today, lte: in60 } } }),
    prisma.document.count({ where: { ...where, expirationDate: { gte: today, lte: in90 } } }),
    prisma.document.count({ where: { ...where, expirationDate: { gte: today } } }),
  ]);

  return { total, valid, expiring90, expiring60, expiring30, expired };
}

export async function getDocumentBuckets(orgId?: string): Promise<ExpirationBuckets> {
  return bucketsFor(orgId ? { organizationId: orgId } : {});
}

export async function getSuperAdminMetrics() {
  const [organizations, totalAdmins, totalUsers, buckets] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count({ where: { role: "ORG_ADMIN" } }),
    prisma.user.count({ where: { role: "USER" } }),
    getDocumentBuckets(),
  ]);
  return { organizations, totalAdmins, totalUsers, ...buckets };
}

export async function getOrgMetrics(orgId: string) {
  const [admins, users, buckets] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: "ORG_ADMIN" } }),
    prisma.user.count({ where: { organizationId: orgId, role: "USER" } }),
    getDocumentBuckets(orgId),
  ]);
  return { admins, users, ...buckets };
}

export async function getUserMetrics(userId: string) {
  return bucketsFor({ ownerId: userId });
}
