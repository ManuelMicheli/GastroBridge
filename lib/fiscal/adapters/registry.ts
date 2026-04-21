// lib/fiscal/adapters/registry.ts
import type { FiscalProvider } from "../types.ts";
import type { PosAdapter } from "./types.ts";
import { mockAdapter } from "./mock/index.ts";
import { genericWebhookAdapter } from "./generic-webhook/index.ts";
import { tilbyAdapter } from "./tilby/index.ts";

const registry: Partial<Record<FiscalProvider, PosAdapter>> = {
  tilby: tilbyAdapter,
  generic_webhook: genericWebhookAdapter,
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
