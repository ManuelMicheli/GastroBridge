// scripts/fiscal-e2e-smoke.mjs
// End-to-end webhook smoke test:
//   1. Create a fiscal_integrations row (generic_webhook).
//   2. HMAC-sign a generic-webhook payload.
//   3. POST it to the webhook route handler we exposed.
//   4. Verify the resulting fiscal_receipts row.
//   5. Clean up.
//
// Run:
//   1) In another shell: npm run dev
//   2) Here:           node --env-file=.env.local scripts/fiscal-e2e-smoke.mjs

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const APP_URL = process.env.FISCAL_APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WEBHOOK_SECRET = "e2e-smoke-secret-xyz";

async function main() {
  const { data: rest, error: restErr } = await supabase
    .from("restaurants")
    .select("id")
    .limit(1)
    .single();
  if (restErr) throw new Error(`no restaurant: ${restErr.message}`);
  const restaurantId = rest.id;

  const { data: int, error: intErr } = await supabase
    .from("fiscal_integrations")
    .insert({
      restaurant_id: restaurantId,
      provider: "generic_webhook",
      status: "active",
      display_name: "E2E smoke",
      config: { device_id: "e2e-smoke" },
      webhook_secret: WEBHOOK_SECRET,
    })
    .select("id")
    .single();
  if (intErr) throw new Error(`insert integration: ${intErr.message}`);
  const integrationId = int.id;
  console.log("integration:", integrationId);

  const externalId = `e2e-${Date.now()}`;
  const payload = {
    external_id: externalId,
    event_type: "receipt.created",
    issued_at: new Date().toISOString(),
    subtotal_cents: 1800,
    vat_cents: 180,
    total_cents: 1980,
    payment_method: "cash",
    covers: 1,
    items: [
      {
        line_number: 1,
        pos_item_id: "P-1",
        name: "Caffè",
        quantity: 1,
        unit_price_cents: 1800,
        subtotal_cents: 1800,
        vat_rate: 10,
      },
    ],
  };
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");

  const res = await fetch(`${APP_URL}/api/fiscal/webhooks/generic_webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gb-signature": sig,
      "x-gb-integration-id": integrationId,
    },
    body,
  });
  console.log("webhook status:", res.status);
  const responseBody = await res.json().catch(() => null);
  console.log("webhook body:", responseBody);

  if (res.status !== 200) throw new Error(`webhook failed: ${res.status}`);

  const { data: receipt, error: recErr } = await supabase
    .from("fiscal_receipts")
    .select("id, total_cents, status")
    .eq("integration_id", integrationId)
    .eq("external_id", externalId)
    .single();
  if (recErr) throw new Error(`no receipt: ${recErr.message}`);
  console.log("receipt:", receipt);
  if (receipt.total_cents !== 1980) {
    throw new Error(`expected total 1980, got ${receipt.total_cents}`);
  }

  // Cleanup
  await supabase.from("fiscal_receipts").delete().eq("integration_id", integrationId);
  await supabase.from("fiscal_integrations").delete().eq("id", integrationId);
  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error("SMOKE FAIL:", err.message);
  process.exit(1);
});
