import "server-only";
import { createHash } from "node:crypto";

// Free replacement for Supabase's Pro-only "leaked password protection".
// Uses the HaveIBeenPwned range API with k-anonymity: only the first 5 hex chars
// of the password's SHA-1 hash ever leave the server — the password and its full
// hash never do. Server-side only (never bundled to the client).

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 2500;
const MIN_LENGTH = 10;

/**
 * Returns true if the password appears in a known breach corpus.
 * Fails OPEN (returns false) on timeout / network error so an HIBP outage can never
 * block sign-ups or password changes — this mirrors Supabase's own behaviour.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(HIBP_RANGE_URL + prefix, {
        // Padding hides the real bucket size from a network observer.
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return false; // fail open

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        // Padded (fake) entries are returned with a count of 0.
        return Number(countStr ?? "0") > 0;
      }
    }
    return false;
  } catch {
    return false; // fail open on any error (timeout, DNS, abort…)
  }
}

/**
 * Full new-password policy: minimum length + not-breached. Returns a user-facing
 * error string when rejected. Used by sign-up and the password-change flow.
 */
export async function validateNewPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return { ok: false, error: `La password deve avere almeno ${MIN_LENGTH} caratteri.` };
  }
  if (await isPasswordPwned(password)) {
    return {
      ok: false,
      error:
        "Questa password compare in violazioni di dati note ed è facilmente indovinabile. Scegline un'altra.",
    };
  }
  return { ok: true };
}
