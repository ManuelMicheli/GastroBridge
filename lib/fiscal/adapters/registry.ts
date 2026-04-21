// lib/fiscal/adapters/registry.ts
import type { FiscalProvider } from "../types.ts";
import type { PosAdapter } from "./types.ts";
import { mockAdapter } from "./mock/index.ts";
import { genericWebhookAdapter } from "./generic-webhook/index.ts";
import { tilbyAdapter } from "./tilby/index.ts";
import { csvUploadAdapter } from "./csv-upload/index.ts";
import { cassaInCloudAdapter } from "./cassa-in-cloud/index.ts";
import { lightspeedAdapter } from "./lightspeed/index.ts";
import { sclobyAdapter } from "./scloby/index.ts";

const registry: Partial<Record<FiscalProvider, PosAdapter>> = {
  tilby: tilbyAdapter,
  cassa_in_cloud: cassaInCloudAdapter,
  lightspeed: lightspeedAdapter,
  scloby: sclobyAdapter,
  generic_webhook: genericWebhookAdapter,
  csv_upload: csvUploadAdapter,
};

export function getAdapter(provider: FiscalProvider): PosAdapter {
  const a = registry[provider];
  if (!a) {
    throw new Error(`No adapter registered for provider "${provider}"`);
  }
  return a;
}

export function getMockAdapter(): PosAdapter {
  return mockAdapter;
}
