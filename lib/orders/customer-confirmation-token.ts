import { createHmac, timingSafeEqual } from "node:crypto";

const CUSTOMER_CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

function getHmacSecret(): string {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET mancante: impossibile firmare token di conferma cliente",
    );
  }
  return secret;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signCustomerConfirmationToken(splitId: string, ttlMs = CUSTOMER_CONFIRM_TTL_MS): string {
  const payload = { splitId, exp: Date.now() + ttlMs };
  const payloadEncoded = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", getHmacSecret()).update(payloadEncoded).digest();
  return `${payloadEncoded}.${b64urlEncode(sig)}`;
}

export function verifyCustomerConfirmationToken(
  token: string,
  expectedSplitId: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const [payloadEncoded, sigEncoded] = token.split(".");
    if (!payloadEncoded || !sigEncoded) return { ok: false, error: "Token malformato" };

    const expectedSig = createHmac("sha256", getHmacSecret()).update(payloadEncoded).digest();
    const actualSig = b64urlDecode(sigEncoded);
    if (expectedSig.length !== actualSig.length) {
      return { ok: false, error: "Firma token non valida" };
    }
    if (!timingSafeEqual(expectedSig, actualSig)) {
      return { ok: false, error: "Firma token non valida" };
    }

    const payload = JSON.parse(b64urlDecode(payloadEncoded).toString("utf8")) as {
      splitId?: string;
      exp?: number;
    };
    if (!payload.splitId || payload.splitId !== expectedSplitId) {
      return { ok: false, error: "Token non valido per questo ordine" };
    }
    if (!payload.exp || payload.exp < Date.now()) {
      return { ok: false, error: "Token scaduto" };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verifica token fallita",
    };
  }
}

export { CUSTOMER_CONFIRM_TTL_MS };
