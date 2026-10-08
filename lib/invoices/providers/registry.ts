// lib/invoices/providers/registry.ts
// Active SDI provider, chosen by env INVOICES_SDI_PROVIDER (default
// "openapi"). Add a new intermediary by implementing SdiProvider and
// registering it here.

import { mockProvider } from "./mock.ts";
import { openapiProvider } from "./openapi.ts";
import type { SdiProvider } from "./types.ts";

const PROVIDERS: Record<string, SdiProvider> = {
  openapi: openapiProvider,
  mock: mockProvider,
};

export function getProvider(id: string): SdiProvider | null {
  return PROVIDERS[id] ?? null;
}

export function activeProvider(): SdiProvider {
  const id = (process.env.INVOICES_SDI_PROVIDER ?? "openapi").trim() || "openapi";
  // The simulator is for development only.
  if (id === "mock" && process.env.NODE_ENV === "production") return openapiProvider;
  return PROVIDERS[id] ?? openapiProvider;
}

export function listProviders(): SdiProvider[] {
  return Object.values(PROVIDERS);
}
