// lib/fiscal/oauth-state.ts
// HMAC-signed OAuth state helper. Prevents CSRF by tying the returned
// state to the integration_id the initiator requested.

import { createHmac } from "node:crypto";

function secret(): string {
  const s = process.env.FISCAL_OAUTH_STATE_SECRET;
  if (!s) throw new Error("FISCAL_OAUTH_STATE_SECRET not set");
  return s;
}

export function signOAuthState(integrationId: string): string {
  const payload = Buffer.from(integrationId, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  if (expected !== sig) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
