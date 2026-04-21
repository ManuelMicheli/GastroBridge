"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUnprocessedEvents } from "./normalizer";
import {
  buildReceiptsFromCsv,
  parseCsvPreview,
  type CsvMapping,
  type CsvPreview,
} from "./csv";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

async function requireOwner(restaurantId: string): Promise<string> {
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
  return user.id;
}

export async function previewFiscalCsv(
  restaurantId: string,
  content: string,
): Promise<CsvPreview> {
  await requireOwner(restaurantId);
  return parseCsvPreview(content);
}

export interface CsvImportResult {
  receipts_inserted: number;
  rows_with_errors: number;
  errors: Array<{ row: number; message: string }>;
  integration_id: string;
}

export async function importFiscalCsv(input: {
  restaurant_id: string;
  integration_id?: string;
  display_name?: string;
  mapping: CsvMapping;
  content: string;
}): Promise<CsvImportResult> {
  await requireOwner(input.restaurant_id);
  const admin = createAdminClient() as Loose;

  let integrationId = input.integration_id;
  if (!integrationId) {
    const { data, error } = await admin
      .from("fiscal_integrations")
      .insert({
        restaurant_id: input.restaurant_id,
        provider: "csv_upload",
        status: "active",
        display_name: input.display_name ?? "Import CSV",
        config: { csv_mapping: input.mapping },
      })
      .select("id")
      .single();
    if (error) throw new Error(`create csv integration: ${error.message}`);
    integrationId = (data as { id: string }).id;
  } else {
    await admin
      .from("fiscal_integrations")
      .update({ config: { csv_mapping: input.mapping } })
      .eq("id", integrationId);
  }

  const { receipts, errors } = buildReceiptsFromCsv(input.content, input.mapping);

  if (receipts.length > 0) {
    const rows = receipts.map((r) => ({
      integration_id: integrationId!,
      external_id: r.external_id,
      event_type: "receipt.created",
      payload: r as unknown as Record<string, unknown>,
    }));
    const { error: insErr } = await admin
      .from("fiscal_raw_events")
      .upsert(rows, {
        onConflict: "integration_id,external_id,event_type",
        ignoreDuplicates: false, // CSV re-import should update payload
      });
    if (insErr) throw new Error(`insert raw_events: ${insErr.message}`);
  }

  try {
    await processUnprocessedEvents(Math.max(receipts.length * 2, 100));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ row: 0, message: `normalizer: ${msg}` });
  }

  revalidatePath("/finanze");
  revalidatePath("/finanze/scontrini");
  revalidatePath("/finanze/integrazioni");

  return {
    receipts_inserted: receipts.length,
    rows_with_errors: errors.length,
    errors: errors.slice(0, 25),
    integration_id: integrationId!,
  };
}
