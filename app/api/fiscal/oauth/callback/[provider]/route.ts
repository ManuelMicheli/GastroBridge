// app/api/fiscal/oauth/callback/[provider]/route.ts
// OAuth2 redirect landing. Exchanges `code` for credentials via the
// provider adapter, encrypts them, persists them, flips the
// integration status to 'active'.
//
// `state` carries the integration_id (base64url-signed with
// FISCAL_OAUTH_STATE_SECRET to prevent CSRF).

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/fiscal/adapters/registry.ts";
import { saveCredentials } from "@/lib/fiscal/credentials";
import type { FiscalProvider } from "@/lib/fiscal/types.ts";

const ALLOWED_PROVIDERS: readonly FiscalProvider[] = [
  "tilby",
  "cassa_in_cloud",
  "lightspeed",
  "scloby",
  "tcpos",
  "revo",
  "simphony",
  "hiopos",
];

function isFiscalProvider(p: string): p is FiscalProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(p);
}

function signState(integrationId: string): string {
  const secret = process.env.FISCAL_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("FISCAL_OAUTH_STATE_SECRET not set");
  const payload = Buffer.from(integrationId, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyState(state: string): string | null {
  const secret = process.env.FISCAL_OAUTH_STATE_SECRET;
  if (!secret) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (expected !== sig) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export { signState };

function redirectUri(request: Request, provider: string): string {
  const u = new URL(request.url);
  return `${u.origin}/api/fiscal/oauth/callback/${provider}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isFiscalProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      new URL(`/finanze/integrazioni?error=${encodeURIComponent(err)}`, url),
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "missing code or state" }, { status: 400 });
  }

  const integrationId = verifyState(state);
  if (!integrationId) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  // Verify requesting user owns this integration before continuing.
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: int, error: intErr } = await admin
    .from("fiscal_integrations")
    .select("id, restaurant_id, provider")
    .eq("id", integrationId)
    .maybeSingle();
  if (intErr || !int) {
    return NextResponse.json({ error: "integration not found" }, { status: 404 });
  }
  if (int.provider !== provider) {
    return NextResponse.json({ error: "provider mismatch" }, { status: 400 });
  }

  const { data: owns } = await admin.rpc("fiscal_owns_restaurant", {
    _restaurant_id: int.restaurant_id,
    _user_id: user.id,
  });
  if (!owns) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const adapter = getAdapter(provider);
  if (!adapter.exchangeCode) {
    return NextResponse.json(
      { error: "provider does not support OAuth" },
      { status: 400 },
    );
  }

  try {
    const creds = await adapter.exchangeCode(code, redirectUri(request, provider));
    await saveCredentials(integrationId, creds);
    await admin
      .from("fiscal_integrations")
      .update({ status: "active", last_error: null })
      .eq("id", integrationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("fiscal_integrations")
      .update({ status: "error", last_error: msg })
      .eq("id", integrationId);
    return NextResponse.redirect(
      new URL(
        `/finanze/integrazioni?error=${encodeURIComponent(msg)}`,
        url,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(`/finanze/integrazioni?connected=${provider}`, url),
  );
}
