/**
 * Resend email wrapper.
 * Uses `from='ordini@gastrobridge.it'` as default sender.
 * Falls back to console logging if RESEND_API_KEY is missing (dev safety).
 */

import { Resend } from "resend";

const DEFAULT_FROM = "GastroBridge <ordini@gastrobridge.it>";

let _client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const client = getClient();
  if (!client) {
    console.warn("[notifications:email] RESEND_API_KEY missing — skipping send to", input.to);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: input.from ?? DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (error) {
      console.error("[notifications:email] Resend error", error);
      return { ok: false, error: error.message ?? "Resend error" };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[notifications:email] send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
