"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCredentials } from "./credentials";
import type { FiscalProvider } from "./types";

const API_KEY_PROVIDERS: readonly FiscalProvider[] = [
  "cassa_in_cloud",
  "scloby",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

async function requireOwner(
  restaurantId: string,
): Promise<{ userId: string; supabase: Loose }> {
  const supabase = (await createClient()) as Loose;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data: owns } = await supabase.rpc("fiscal_owns_restaurant", {
    _restaurant_id: restaurantId,
    _user_id: user.id,
  });
  if (!owns) throw new Error("forbidden");
  return { userId: user.id, supabase };
}

export async function setFiscalEnabled(
  restaurantId: string,
  enabled: boolean,
): Promise<void> {
  await requireOwner(restaurantId);
  const admin = createAdminClient() as Loose;
  await admin
    .from("restaurant_preferences")
    .upsert(
      { restaurant_id: restaurantId, fiscal_enabled: enabled },
      { onConflict: "restaurant_id" },
    );
  revalidatePath("/finanze");
  revalidatePath("/finanze/integrazioni");
}

export async function createFiscalIntegration(input: {
  restaurant_id: string;
  provider: FiscalProvider;
  display_name?: string;
  device_id?: string;
}): Promise<{ id: string; webhook_secret: string | null }> {
  await requireOwner(input.restaurant_id);
  const admin = createAdminClient() as Loose;

  const needsWebhookSecret =
    input.provider === "generic_webhook" ||
    input.provider === "tilby" ||
    input.provider === "scloby" ||
    input.provider === "lightspeed";
  const webhook_secret = needsWebhookSecret
    ? randomBytes(32).toString("hex")
    : null;
  const status =
    input.provider === "generic_webhook" ? "active" : "pending_auth";

  const { data, error } = await admin
    .from("fiscal_integrations")
    .insert({
      restaurant_id: input.restaurant_id,
      provider: input.provider,
      status,
      display_name: input.display_name ?? null,
      config: input.device_id ? { device_id: input.device_id } : {},
      webhook_secret,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createIntegration: ${error.message}`);
  revalidatePath("/finanze/integrazioni");
  revalidatePath("/finanze");
  return { id: data.id as string, webhook_secret };
}

export async function pauseFiscalIntegration(
  integrationId: string,
): Promise<void> {
  const admin = createAdminClient() as Loose;
  const { data } = await admin
    .from("fiscal_integrations")
    .select("restaurant_id")
    .eq("id", integrationId)
    .single();
  if (!data) throw new Error("integration not found");
  await requireOwner(data.restaurant_id as string);

  await admin
    .from("fiscal_integrations")
    .update({ status: "paused" })
    .eq("id", integrationId);
  revalidatePath("/finanze/integrazioni");
}

export async function resumeFiscalIntegration(
  integrationId: string,
): Promise<void> {
  const admin = createAdminClient() as Loose;
  const { data } = await admin
    .from("fiscal_integrations")
    .select("restaurant_id")
    .eq("id", integrationId)
    .single();
  if (!data) throw new Error("integration not found");
  await requireOwner(data.restaurant_id as string);

  await admin
    .from("fiscal_integrations")
    .update({ status: "active", last_error: null })
    .eq("id", integrationId);
  revalidatePath("/finanze/integrazioni");
}

export async function setFiscalApiKey(
  integrationId: string,
  input: { api_key: string; shop_id?: string },
): Promise<void> {
  const admin = createAdminClient() as Loose;
  const { data } = await admin
    .from("fiscal_integrations")
    .select("restaurant_id, provider, config")
    .eq("id", integrationId)
    .single();
  if (!data) throw new Error("integration not found");
  await requireOwner(data.restaurant_id as string);

  const provider = data.provider as FiscalProvider;
  if (!API_KEY_PROVIDERS.includes(provider)) {
    throw new Error("provider non usa API key");
  }
  const apiKey = input.api_key.trim();
  if (!apiKey) throw new Error("API key mancante");
  const shopId = input.shop_id?.trim() || undefined;

  await saveCredentials(integrationId, {
    kind: "api_key",
    api_key: apiKey,
    ...(shopId ? { shop_id: shopId } : {}),
  });

  const prevConfig = (data.config ?? {}) as Record<string, unknown>;
  const nextConfig = shopId
    ? { ...prevConfig, shop_id: shopId }
    : prevConfig;

  await admin
    .from("fiscal_integrations")
    .update({ status: "active", last_error: null, config: nextConfig })
    .eq("id", integrationId);

  revalidatePath("/finanze/integrazioni");
  revalidatePath("/finanze");
}

export async function deleteFiscalIntegration(
  integrationId: string,
): Promise<void> {
  const admin = createAdminClient() as Loose;
  const { data } = await admin
    .from("fiscal_integrations")
    .select("restaurant_id")
    .eq("id", integrationId)
    .single();
  if (!data) throw new Error("integration not found");
  await requireOwner(data.restaurant_id as string);

  await admin.from("fiscal_integrations").delete().eq("id", integrationId);
  revalidatePath("/finanze/integrazioni");
  revalidatePath("/finanze");
}
