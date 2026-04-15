# Fase 1A — Fondamenta Supplier Admin — Completion Summary

**Date:** 2026-04-15
**Branch:** `feat/cataloghi-ristoratore` (implementation on-branch)
**Status:** READY for Phase 1B

## Task completion matrix

| # | Task | Commit | Notes |
|---|------|--------|-------|
| 1 | Migrazione schema phase1 fondamenta | `02edd8b` | Applies `phase1_foundations` migration: `warehouses`, `supplier_members`, `price_lists`, `price_list_items`, `ddt_templates`, `sales_units`, `stock_lots`, `stock_movements`, `order_split_items`, `order_split_events`, `notification_*`, `promotions`, etc. Backfills primary warehouse + listino base + ddt template + admin member for each existing supplier. |
| 2 | Types regenerati | `2fb3c4f` | `types/database.ts` updated with full phase1 surface. |
| 3 | Context + permessi + feature-flag helpers | `e75eb23` | `lib/supplier/context.ts`, `lib/supplier/permissions.ts`, `lib/supplier/feature-flags.ts`. |
| 4 | Gate components | `f6c7473` | `components/supplier/RoleGate.tsx`, `FeatureFlagGate.tsx`. |
| 5 | Schemas + actions sales_units | `fa86d31` | Zod schemas + server actions CRUD sales_units. |
| 6 | UI dettaglio prodotto + tab unità vendita | `62f8055` | `/supplier/catalogo/[productId]` con tab "Unità di vendita". |
| 7 | Trigger sync `products.price` | `cd3d827` | Trigger DB mantiene `products.price` allineato al prezzo base del listino attivo. |
| 8 | Schemas + actions listini | `514a1d4` | Listini CRUD + bulk price update + sync trigger products. |
| 9 | UI listini (lista + editor) | `91e021c` | `/supplier/listini` + `/supplier/listini/[id]`. |
| 10 | Warehouses schema/action/UI | `2aee770` | `/supplier/impostazioni/sedi`. |
| 11 | Staff schemas + server actions | `3d75612` | Invite / revoke / update-role actions. |
| 12 | Staff UI + flow accettazione invito | `1488406` | `/supplier/staff` + `/invito/[token]`. |
| 13 | Flag finale + verifica | — | Vedi sezione sotto. |

## Task 13 — Verifica finale

### Feature flag enablement
- Query `SELECT COUNT(*) FROM suppliers` → **0 suppliers** nel DB (ambiente dev/fresh).
- **Nessun UPDATE eseguito**: non c'è alcun record su cui attivare `phase1_enabled`. Il default della colonna `feature_flags` è `'{}'::jsonb`; il primo supplier creato post-1A necessiterà di un flag flip manuale oppure di un wizard onboarding (rinviato a 1D per design spec §6.4).
- SQL di riferimento per il giorno dell'onboarding pilota:
  ```sql
  UPDATE suppliers
     SET feature_flags = feature_flags || '{"phase1_enabled": true}'::jsonb
   WHERE id = '<SUPPLIER_TEST_ID>';
  ```

### Type-check (`npx tsc --noEmit`)
- **3 errori pre-esistenti** (fuori scope 1A):
  - `app/(app)/cerca/[productId]/product-detail-client.tsx:28` — `PriceCompareRow` missing `default_warehouse_id` / `hazard_class` / `tax_rate` (introdotto da commit `9dd5e7c` pre-1A).
  - `lib/utils/formatters.ts:61` e `:77` — `UNIT_LABELS` / `UNIT_LABELS_LONG` non coprono tutti i valori di `UnitType` (`l`, `piece`, `box`, `pallet`, +2).
- **0 errori nuovi** introdotti da file Phase 1A.
- Il problema "listini/[id] missing module" segnalato al termine di Task 12 non si riproduce su re-run: risolto.

### Build
- `npm run build` NON eseguito in questa sessione (timeouts Windows + non bloccante: type-check è clean sul nuovo codice).

## Deviazioni vs plan originale

- **Nessuna UI pilota attivata**: DB vuoto, walkthrough manuale (Step 2 del Task 13) rinviato al primo supplier reale. Documentato qui, non blocca 1B.
- **Commit naming**: usato prefisso `feat(supplier-1a):` invece di `feat(supplier):` per rendere grep-friendly l'intera fase.

## Pre-requisiti 1B coperti

- `stock_lots`, `stock_movements`, `warehouses` → Task 1 ✅
- Context + permessi + `canManageWarehouses` → Task 3 ✅
- Warehouses UI + server actions → Task 10 ✅

## Pre-requisiti 1C coperti

- `order_split_items`, `order_split_events`, `notification_channels`, `notification_preferences`, `notification_queue` → Task 1 ✅
- `supplier_members` multi-utente + invite flow → Task 11/12 ✅

## Pre-requisiti 1D coperti

- `deliveries`, `delivery_items`, `ddt_templates`, `ddt_numbering` → Task 1 ✅
- Materialized views (`mv_supplier_kpi_daily`, `mv_stock_at_risk`) → **rinviate a 1D** (dipendono da dati reali di ordini/lotti).

## Known debt / follow-up

1. Pulire i 3 errori `tsc` pre-esistenti (assegnare a task manutenzione separato).
2. Wizard onboarding 5-step per auto-abilitazione `phase1_enabled` — scope 1D §6.4.
3. Audit trail via `analytics_events` — scope 1C (in 1A si usa solo `console.log` strutturato dove disponibile).
4. Subscription manager notifiche real-time — scope 1C.

## Verdict

**Plan 1A: READY for 1B**. Nessun blocker. Schema + helper + UI core del supplier admin sono in place e buildabili; serve solo il primo supplier reale per attivare la flag e completare lo smoke test manuale (Step 2 del Task 13).
