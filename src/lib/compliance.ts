import { prisma } from "@/lib/db";

export type UserCompliance = {
  userId: string;
  name: string | null;
  email: string;
  customRoleName: string | null;
  required: number;
  satisfied: number;
  percent: number;
  isCompliant: boolean;
};

export type OrgCompliance = {
  users: UserCompliance[];
  totalUsers: number;
  applicableUsers: number;
  compliantUsers: number;
  compliancePercent: number;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOrgCompliance(orgId: string): Promise<OrgCompliance> {
  const today = startOfToday();

  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      customRole: {
        select: {
          name: true,
          requiredDocuments: { select: { id: true } },
        },
      },
      documents: {
        where: {
          expirationDate: { gte: today },
          requiredDocumentId: { not: null },
        },
        select: { requiredDocumentId: true },
      },
    },
  });

  const list: UserCompliance[] = users.map((u) => {
    const required = u.customRole?.requiredDocuments.map((r) => r.id) ?? [];
    const satisfied = new Set<string>();
    for (const d of u.documents) {
      if (d.requiredDocumentId && required.includes(d.requiredDocumentId)) {
        satisfied.add(d.requiredDocumentId);
      }
    }
    const requiredCount = required.length;
    const satisfiedCount = satisfied.size;
    const percent =
      requiredCount === 0 ? 100 : Math.round((satisfiedCount / requiredCount) * 100);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      customRoleName: u.customRole?.name ?? null,
      required: requiredCount,
      satisfied: satisfiedCount,
      percent,
      isCompliant: requiredCount === 0 || satisfiedCount === requiredCount,
    };
  });

  const applicable = list.filter((u) => u.required > 0);
  const compliantCount = applicable.filter((u) => u.isCompliant).length;
  const compliancePercent =
    applicable.length === 0 ? 100 : Math.round((compliantCount / applicable.length) * 100);

  return {
    users: list,
    totalUsers: list.length,
    applicableUsers: applicable.length,
    compliantUsers: compliantCount,
    compliancePercent,
  };
}

export type RequirementStatus = {
  requiredDocumentId: string;
  name: string;
  document: { id: string; name: string; fileUrl: string; expirationDate: Date } | null;
  status: "missing" | "expired" | "expiring-soon" | "valid";
};

export async function getUserRequirementStatus(userId: string): Promise<RequirementStatus[]> {
  const today = startOfToday();
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      customRole: {
        select: {
          requiredDocuments: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const required = user?.customRole?.requiredDocuments ?? [];
  if (required.length === 0) return [];

  const docs = await prisma.document.findMany({
    where: {
      ownerId: userId,
      requiredDocumentId: { in: required.map((r) => r.id) },
    },
    orderBy: { expirationDate: "desc" },
    select: {
      id: true,
      name: true,
      fileUrl: true,
      expirationDate: true,
      requiredDocumentId: true,
    },
  });

  const latestByReq = new Map<string, (typeof docs)[number]>();
  for (const d of docs) {
    if (!d.requiredDocumentId) continue;
    if (!latestByReq.has(d.requiredDocumentId)) latestByReq.set(d.requiredDocumentId, d);
  }

  return required.map((r) => {
    const doc = latestByReq.get(r.id) ?? null;
    let status: RequirementStatus["status"] = "missing";
    if (doc) {
      if (doc.expirationDate < today) status = "expired";
      else if (doc.expirationDate <= in30) status = "expiring-soon";
      else status = "valid";
    }
    return {
      requiredDocumentId: r.id,
      name: r.name,
      document: doc
        ? { id: doc.id, name: doc.name, fileUrl: doc.fileUrl, expirationDate: doc.expirationDate }
        : null,
      status,
    };
  });
}
