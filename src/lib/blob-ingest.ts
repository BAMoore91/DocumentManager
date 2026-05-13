import { put } from "@vercel/blob";

const MAX_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export class BlobIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlobIngestError";
  }
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "document";
}

function fileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const decoded = (() => {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  })();
  return sanitizeFileName(decoded || "document.pdf");
}

export type IngestedPdf = {
  blobUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export async function fetchAndStorePdf({
  url,
  blobPathPrefix,
}: {
  url: string;
  blobPathPrefix: string;
}): Promise<IngestedPdf> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlobIngestError("Source URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new BlobIngestError("Only HTTPS source URLs are allowed");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "DocManager-SDS-Importer/1.0",
        Accept: "application/pdf,*/*;q=0.5",
      },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new BlobIngestError("Source URL took longer than 30s to respond");
    }
    throw new BlobIngestError(
      `Failed to fetch source URL: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new BlobIngestError(
      `Source URL returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    throw new BlobIngestError(
      `Source URL did not return a PDF (content-type: ${contentType || "unknown"})`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_BYTES) {
    throw new BlobIngestError(
      `Source PDF is ${Math.round(contentLength / 1024 / 1024)} MB — limit is 15 MB`,
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new BlobIngestError("Source PDF exceeds 15 MB");
  }

  const fileName = fileNameFromUrl(parsed);
  const blobPath = `${blobPathPrefix}/${Date.now()}-${fileName}`;
  const blob = await put(blobPath, Buffer.from(buffer), {
    access: "public",
    contentType: "application/pdf",
  });

  return {
    blobUrl: blob.url,
    fileName,
    fileSize: buffer.byteLength,
    mimeType: "application/pdf",
  };
}
