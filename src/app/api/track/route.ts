import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "site_session";
const CONSENT_COOKIE = "site_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function getClientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const consent = cookieStore.get(CONSENT_COOKIE)?.value;
  if (consent !== "1") {
    return NextResponse.json({ ok: true, recorded: false });
  }

  let body: { path?: unknown; referrer?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "/";
  const referrer =
    typeof body.referrer === "string" && body.referrer
      ? body.referrer.slice(0, 500)
      : null;

  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;
  const ipAddress = getClientIp(h)?.slice(0, 100) ?? null;

  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = randomUUID();
  }

  await prisma.siteVisit.create({
    data: {
      sessionId,
      path,
      referrer,
      userAgent,
      ipAddress,
    },
  });

  const res = NextResponse.json({ ok: true, recorded: true });
  if (isNewSession) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      maxAge: ONE_YEAR,
      sameSite: "lax",
      path: "/",
      httpOnly: true,
    });
  }
  return res;
}
