import "server-only";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails "sent" with EMAIL_TRANSPORT=memory (tests only). */
export const sentEmails: Email[] = [];

export class EmailNotConfiguredError extends Error {
  override name = "EmailNotConfiguredError";
}

/**
 * Sends one email.
 * - EMAIL_TRANSPORT=memory: kept in `sentEmails` (tests)
 * - RESEND_API_KEY set: sent through Resend's HTTP API (from EMAIL_FROM)
 * - otherwise, outside production: printed to the server console (local development)
 */
export async function sendEmail(email: Email): Promise<void> {
  if (process.env.EMAIL_TRANSPORT === "memory") {
    sentEmails.push(email);
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "LiveRate <onboarding@resend.dev>",
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Email provider error ${res.status}`);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[email] to ${email.to}: ${email.subject}\n${email.text}\n`);
    return;
  }
  throw new EmailNotConfiguredError("RESEND_API_KEY is not set");
}

/** Base URL for links in emails. Never derived from the request's Host header. */
export function siteUrlForEmail(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, body: string, cta: string, link: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f2ff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1446">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:2px solid #1a1446;border-radius:20px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 4px;font-weight:800;font-size:18px">LiveRate</p>
<h1 style="margin:16px 0 8px;font-size:24px">${escape(heading)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escape(body)}</p>
<a href="${escape(link)}" style="display:inline-block;background:#6a3df5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;border:2px solid #1a1446">${escape(cta)}</a>
<p style="margin:24px 0 0;font-size:13px;color:#4a4478;line-height:1.5">${escape(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(to: string, link: string): Email {
  const footer = "This link works once and expires in 24 hours. If you didn't sign up for LiveRate, ignore this email.";
  return {
    to,
    subject: "Verify your email for LiveRate",
    text: `Confirm your email to start creating presentations:\n\n${link}\n\n${footer}`,
    html: layout("Verify your email", "Confirm your email to start creating presentations.", "Verify email", link, footer),
  };
}

export function resetEmail(to: string, link: string): Email {
  const footer = "This link works once and expires in 30 minutes. If you didn't ask to reset your password, ignore this email; your password stays the same.";
  return {
    to,
    subject: "Reset your LiveRate password",
    text: `Choose a new password:\n\n${link}\n\n${footer}`,
    html: layout("Reset your password", "Use this link to choose a new password.", "Choose a new password", link, footer),
  };
}
