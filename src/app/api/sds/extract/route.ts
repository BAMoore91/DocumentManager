import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractSdsMetadata } from "@/lib/ai/sds-extract";
import { AnthropicConfigError, isAnthropicConfigured } from "@/lib/ai/anthropic";

const MAX_BYTES = 15 * 1024 * 1024;

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ORG_ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI extraction is not configured on this server" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }
  if (file.type && !file.type.toLowerCase().includes("pdf")) {
    return NextResponse.json(
      { ok: false, error: "Only PDF files are supported for AI extraction" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 15 MB" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const metadata = await extractSdsMetadata(bytes);
    return NextResponse.json({ ok: true, metadata });
  } catch (err) {
    if (err instanceof AnthropicConfigError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
