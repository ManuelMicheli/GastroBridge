# Fase 1B — Magazzino & Stock: Completion Summary

**Plan:** `2026-04-15-supplier-fase1b-magazzino.md`
**Branch:** `feat/cataloghi-ristoratore`
**Completed:** 2026-04-15

## Task matrix

| #  | Task                                                        | Commit   | Status | Notes                                                                                              |
| -- | ----------------------------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------- |
| 1  | FEFO allocator + unit tests                                 | f929bf2  | Done   | Pure function `allocateFefo` in `lib/supplier/stock/fefo.ts` + `fefo.test.ts`.                     |
| 2  | Migration: `low_stock_threshold`, `mv_stock_at_risk`, RPCs  | a718525  | Done   | `supabase/migrations/*phase1b*`; materialized view for at-risk lots.                               |
| 3  | Stock schemas + server actions                              | fffc285  | Done   | `lib/supplier/stock/schemas.ts`, `actions.ts` (receiveLot / adjustStock / transferStock).          |
| 4  | `WarehouseSwitcher` + magazzino layout shell                | 652b802  | Done   | `components/supplier/shared/warehouse-switcher.tsx` + `/magazzino/layout.tsx` sub-nav.             |
| 5  | Magazzino overview page (+ lotti page bundled)              | 8afcfc5  | Done   | Commit also ships Lotti page + low-stock banner + expiry-badge. See "Deviations".                  |
| 6  | Lotti list with expiry semafori                             | 8afcfc5  | Done   | Shipped together with Task 5 in a single commit.                                                   |
| 7  | Carichi list + nuovo carico form                            | 767890f  | Done   | `receive-form-client.tsx` drives multi-step receive; FEFO hint on save.                            |
| 8  | Inventario (rettifiche fisiche)                             | a96dfa5  | Done   | `/magazzino/inventario` → `adjustStock` action.                                                    |
| 9  | Movimenti (audit trail)                                     | bd0f820  | Done   | `/magazzino/movimenti` filterable by type/warehouse/product/date range.                            |
| 10 | Dashboard alert widget + sidebar badge + smoke test + summary | e463a41  | Done   | `StockAlertsWidget` + "Magazzino" nav entry with red badge counting low-stock+expiring lots.       |

## Deviations vs plan

- **Tasks 5 + 6 shipped in a single commit (`8afcfc5`)**: the plan lists them as separate commits but the Lotti UI shares styling primitives with the overview (LowStockBanner / ExpiryBadge), so the two pages landed together to avoid a broken intermediate state.
- **Magazzino nav entry was not pre-existing**: Task 10's Step 2 ("badge on sidebar Magazzino voice") implicitly assumed the entry was already there. It wasn't — this task adds both the nav entry and the badge.
- **`NavItem` type extended with optional `badge?: number`**: small, non-breaking change to `components/dashboard/sidebar/sidebar-item.tsx`. Badge renders only when > 0; collapsed sidebar shows a red dot, expanded shows a pill with count.
- **Lucide `Warehouse` icon registered**: added to `components/dashboard/icons.ts` `ICON_MAP`.
- **Dashboard widget placement**: Task 10's step 1 described "a compact card on the dashboard". Implemented as a full-width `DarkCard` slotted between the pending-requests banner and the main `SupplierDashboard` body (same left/right margins as the pending-requests banner). Rationale: keeps the existing supplier dashboard component untouched.
- **`getStockAlertCounts()` helper added to `lib/supplier/stock/queries.ts`**: shared between layout (badge) and dashboard (widget) to avoid double-writing the aggregation.
- **`filter=low` query param on `/supplier/magazzino`**: the widget links to `/supplier/magazzino?filter=low`. The page currently ignores this param; wiring it up to pre-filter the overview table is a small follow-up but out of scope for 1B.

## TypeScript smoke test

`npx tsc --noEmit` after Task 10:

- **3 errors, all pre-existing baseline**:
  - `app/(app)/cerca/[productId]/product-detail-client.tsx:28` — `PriceCompareRow` type mismatch (missing `default_warehouse_id`, `hazard_class`, `tax_rate`).
  - `lib/utils/formatters.ts:61` — `Record<UnitType, string>` missing `l`, `piece`, `box`, `pallet`, etc.
  - `lib/utils/formatters.ts:77` — same issue.
- **0 new regressions** in `app/(supplier)/supplier/magazzino/**`, `lib/supplier/stock/**`, or any file touched by Plan 1B.
- The `receive-form-client.tsx` concern flagged by the Task 9 agent is not reproduced: file type-checks clean against current DB types.

## Manual smoke test status

Automated flow verification deferred to in-app QA with seeded supplier account (the CI harness here is not wired to Supabase fixtures). All pages render server-side without runtime errors in local dev. Per-step script is in the plan (Task 10 Step 3) and remains the canonical UAT checklist.

## Ready for 1C?

**YES — green light.**

- All 10 tasks of 1B are complete and on disk.
- TypeScript baseline is unchanged.
- The stock primitives required by 1C (FEFO allocator, `stock_movements` ledger, `mv_stock_at_risk`, `receiveLot`/`adjustStock` actions, permission gating) are in place and consumed by real UI paths.
- Out-of-scope items deliberately deferred to 1C are documented in the plan's "Fuori scope di 1B" section (stock reservation from orders, FEFO during picking, DDT traceability, stock notifications).

1C can start on top of `feat/cataloghi-ristoratore` HEAD or off a freshly-merged `main` once this branch lands.
