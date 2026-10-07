// Per-account localStorage helpers. Several accounts can share one browser
// (staff tablets, kitchen PCs): anything that belongs to an account must be
// keyed by user id, never stored under a global key.

export const TYPICAL_ORDER_BASE_KEY = "gb.typical-order";

export function scopedStorageKey(base: string, userId: string | null | undefined): string | null {
  return userId ? `${base}:${userId}` : null;
}

/**
 * Read `scopedKey`; if it is empty and the legacy global `legacyKey` exists,
 * adopt the legacy value for this account once and delete the global key.
 */
export function readScopedStorage(scopedKey: string | null, legacyKey: string): string | null {
  if (!scopedKey) return null;
  try {
    let value = localStorage.getItem(scopedKey);
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      if (value === null) {
        value = legacy;
        localStorage.setItem(scopedKey, legacy);
      }
      localStorage.removeItem(legacyKey);
    }
    return value;
  } catch {
    return null;
  }
}
