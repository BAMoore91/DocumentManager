// Email channel scaffold. No-ops unless RESEND_API_KEY is set.
// Drop in @resend/node later if you want richer formatting / batching.

type SendArgs = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(args: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "no-reply@example.com";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[email:dry-run]", { from, ...args });
    }
    return;
  }

  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  if (recipients.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: args.subject,
        text: args.text,
        html: args.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend send failed", res.status, body);
    }
  } catch (err) {
    console.error("[email] Resend send error", err);
  }
}
