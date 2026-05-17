import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lookupBest } from "@/lib/pubchem";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { cas?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const cas = typeof body.cas === "string" ? body.cas : null;
  const name = typeof body.name === "string" ? body.name : null;
  if (!cas && !name) {
    return NextResponse.json(
      { ok: false, error: "cas or name required" },
      { status: 400 },
    );
  }

  try {
    const hazard = await lookupBest({ cas, name });
    return NextResponse.json({ ok: true, hazard });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "lookup failed" },
      { status: 502 },
    );
  }
}
