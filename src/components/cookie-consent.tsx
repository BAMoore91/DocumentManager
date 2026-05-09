"use client";

import { useEffect, useState } from "react";

const CHOICE_COOKIE = "cookie_choice";
const CONSENT_COOKIE = "site_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds};` +
    ` path=/; SameSite=Lax`;
}

async function ping(path: string) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer: document.referrer || null }),
      keepalive: true,
    });
  } catch {
    // best-effort only
  }
}

export function CookieConsent({ trackPath }: { trackPath: string }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setChoice(readCookie(CHOICE_COOKIE));
  }, []);

  useEffect(() => {
    if (choice === "accepted") {
      ping(trackPath);
    }
  }, [choice, trackPath]);

  if (!mounted || choice) return null;

  function accept() {
    writeCookie(CHOICE_COOKIE, "accepted", ONE_YEAR);
    writeCookie(CONSENT_COOKIE, "1", ONE_YEAR);
    setChoice("accepted");
  }

  function reject() {
    writeCookie(CHOICE_COOKIE, "rejected", ONE_YEAR);
    writeCookie(CONSENT_COOKIE, "0", ONE_YEAR);
    setChoice("rejected");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[hsl(var(--muted-foreground))]">
          We use cookies to remember you and to understand how visitors use our
          site so we can improve it. You can accept or decline analytics
          cookies — essential cookies for the app are always on.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={reject}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
