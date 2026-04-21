// lib/fiscal/credentials.ts
// Node-side helpers that call the SECURITY DEFINER SQL functions
// fiscal_encrypt_credentials / fiscal_decrypt_credentials.
// Requires the SERVICE ROLE Supabase client — never call from a browser.

import { createAdminClient } from "@/lib/supabase/admin";
import type { Credentials } from "./types";

// Supabase hand-rolled types don't flow through rpc/update overloads
// cleanly; cast through a loosely-typed client at call sites. Matches
// the pattern used by lib/orders/submit.ts and lib/supplier/ddt/numbering.ts.
type LooseClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function loose(): LooseClient {
  return createAdminClient() as unknown as LooseClient;
}

export async function encryptCredentials(creds: Credentials): Promise<string> {
  const { data, error } = await loose().rpc("fiscal_encrypt_credentials", {
    plaintext: creds as unknown as Record<string, unknown>,
  });
  if (error) throw new Error(`encryptCredentials failed: ${error.message}`);
  if (!data) throw new Error("encryptCredentials returned null");
  return data as string;
}

export async function decryptCredentials(
  ciphertext: string,
): Promise<Credentials> {
  const { data, error } = await loose().rpc("fiscal_decrypt_credentials", {
    ciphertext,
  });
  if (error) throw new Error(`decryptCredentials failed: ${error.message}`);
  if (!data) throw new Error("decryptCredentials returned null");
  return data as Credentials;
}

export async function loadCredentials(
  integrationId: string,
): Promise<Credentials | null> {
  const { data, error } = await loose()
    .from("fiscal_integrations")
    .select("credentials_encrypted")
    .eq("id", integrationId)
    .single();
  if (error) throw new Error(`loadCredentials query failed: ${error.message}`);
  const enc = (data as { credentials_encrypted: string | null } | null)
    ?.credentials_encrypted;
  if (!enc) return null;
  return decryptCredentials(enc);
}

export async function saveCredentials(
  integrationId: string,
  creds: Credentials,
): Promise<void> {
  const enc = await encryptCredentials(creds);
  const { error } = await loose()
    .from("fiscal_integrations")
    .update({ credentials_encrypted: enc })
    .eq("id", integrationId);
  if (error) throw new Error(`saveCredentials failed: ${error.message}`);
}
