import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Vercel Cron pings this endpoint daily. Set CRON_SECRET on Vercel and
// configure vercel.json to send Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  // Documents expiring in the next 30 days
  const expiringDocs = await prisma.document.findMany({
    where: { expirationDate: { gte: today, lte: in30 } },
    include: { owner: { select: { email: true, name: true } } },
  });

  // Trainings expiring in the next 30 days
  const expiringTrainings = await prisma.trainingRecord.findMany({
    where: { expiresAt: { gte: today, lte: in30 } },
    include: {
      user: { select: { email: true, name: true } },
      course: { select: { name: true } },
    },
  });

  // Permits ending in the next 7 days
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const expiringPermits = await prisma.permit.findMany({
    where: { status: "ISSUED", validUntil: { gte: today, lte: in7 } },
    include: { recipient: { select: { email: true, name: true } } },
  });

  // Subcontractor COIs expiring in the next 30 days
  const expiringCois = await prisma.subcontractor.findMany({
    where: { insuranceExpiresAt: { gte: today, lte: in30 } },
  });

  let emailsSent = 0;
  for (const d of expiringDocs) {
    if (!d.owner.email) continue;
    await sendEmail({
      to: d.owner.email,
      subject: `Document expiring soon: ${d.name}`,
      text: `Your document "${d.name}" expires on ${d.expirationDate.toDateString()}. Sign in and upload a renewal to stay compliant.`,
    });
    emailsSent++;
  }
  for (const t of expiringTrainings) {
    if (!t.user.email || !t.expiresAt) continue;
    await sendEmail({
      to: t.user.email,
      subject: `Training expiring: ${t.course.name}`,
      text: `Your ${t.course.name} certification expires ${t.expiresAt.toDateString()}.`,
    });
    emailsSent++;
  }
  for (const p of expiringPermits) {
    if (!p.recipient?.email) continue;
    await sendEmail({
      to: p.recipient.email,
      subject: `Permit closing soon: ${p.title}`,
      text: `Permit "${p.title}" is valid until ${p.validUntil.toISOString()}.`,
    });
    emailsSent++;
  }

  return NextResponse.json({
    ok: true,
    counts: {
      docs: expiringDocs.length,
      trainings: expiringTrainings.length,
      permits: expiringPermits.length,
      cois: expiringCois.length,
    },
    emailsSent,
  });
}
