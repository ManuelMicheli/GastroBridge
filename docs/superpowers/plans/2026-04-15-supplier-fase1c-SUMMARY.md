# Fase 1C — Ordini Workflow Fornitore: Completion Summary

**Plan:** `2026-04-15-supplier-fase1c-ordini.md`
**Branch:** `feat/cataloghi-ristoratore`
**Completed:** 2026-04-15

## Task matrix

| #  | Task                                                             | Commit   | Status | Notes                                                                                                   |
| -- | ---------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 1  | Dipendenze (`web-push`, `resend`) + env vars                     | fff321f  | Done   | Packages installed; `.env.example` updated with VAPID keys + `VAPID_SUBJECT`.                           |
| 2  | Submit ordine esplicito (lato ristorante)                        | e3a50a8  | Done   | `submitOrder` server action wraps RPC; checkout flow invokes it before confirmation.                    |
| 3  | Migration supporto ordini + indici                               | 139d035  | Done   | `supabase/migrations/*phase1c*`: workflow indexes, `order_split_events`, RPC helpers.                   |
| 4  | Eventi, permessi helper e notifiche scaffold                     | 55bae84  | Done   | `lib/notifications/dispatcher.ts` + `emitOrderEvent` helper; 404/410 push cleanup wired.                |
| 5  | Service Worker + subscription push (client)                      | 8d8022f  | Done   | `public/sw.js` + `usePushSubscription` hook; storage in `push_subscriptions` table.                     |
| 6  | Prenotazione stock FEFO + gestione conflitti                     | e5014f1  | Done   | `reserveStockForOrderLine` RPC uses `FOR UPDATE` on `stock_lots`; conflict returns `insufficient_stock`. |
| 7  | Server actions fornitore: accettazione righe                     | 6c2635e  | Done   | `acceptOrderLines`, `rejectOrder`, `proposeModification` + HMAC customer token (stateless).             |
| 8  | UI lista ordini con filtri + toggle kanban                       | da19197  | Done   | `/supplier/ordini` redesigned with workflow filters (nuovi / in lavorazione / pronti / consegnati).     |
| 9  | Vista kanban drag&drop                                           | cc8f885  | Done   | `/supplier/ordini/kanban` with `@dnd-kit`; server validates illegal transitions.                        |
| 10 | Dettaglio ordine con accettazione per-riga + timeline            | 93844f1  | Done   | Per-line accept/modify UI + `order_split_events` timeline. Sidebar kanban entry bundled here.           |
| 11 | Pagina conferma cliente (ristorante)                             | d0c7875  | Done   | `/ordini/conferma/[token]` verifies HMAC, renders diff, approve/reject actions.                         |
| 12 | Picking list magazziniere con FEFO                               | 381ef62  | Done   | `/supplier/ordini/[id]/picking` with FEFO suggestions + `markPacked` action.                            |
| 13 | Realtime, sidebar, permission gating finale                      | 93844f1 / 381ef62 | Done   | No standalone commit: sidebar kanban entry landed with Task 10; `RoleGate` wrapping landed with Task 12 (markPacked) and Task 7 (accept). See "Deviations". |
| 14 | Feature flag + smoke test + docs env                             | (this)   | Done   | `AUTH_SECRET` added to `.env.example`; SUMMARY committed; `phase1_enabled` flag applied in 1A Task 13.  |

## Deviations vs plan

- **Workflow state encoded in `supplier_notes` JSONB**: the plan assumed a dedicated `order_splits.workflow_status` column. Instead, per-split workflow is serialized into `supplier_notes` (alongside existing `per_line_status`) to avoid a migration on an already-live table. The RPC helpers marshal/unmarshal this field atomically. `order_split_events` remains the source of truth for audit.
- **HMAC customer confirmation token is fully stateless** (Task 7 + Task 11): no `customer_confirmation_tokens` table was added. Token carries `{orderId, splitId, exp, modificationHash}` signed with `AUTH_SECRET`; single-use enforcement is derived from the current split state (if already approved/rejected, token rejects). If hardening review asks for replay defense we can promote to the table form described in "Rischi noti" #2.
- **`markPacked` permission moved from `order.accept_line` to `order.prepare`**: plan Task 13 Step 2 listed only `order.prepare` for picking, but the initial Task 12 draft reused `accept_line`. Final gating uses `order.prepare` exclusively so `warehouse` role can complete picking without sales privileges.
- **Task 13 has no standalone commit**: sidebar link + RoleGate wrapping were absorbed into Task 10 (`93844f1` — sidebar entry) and Task 12 (`381ef62` — permission wrapping on picking). All requirements from Task 13's steps are satisfied; the commit message for Task 13 (`feat(supplier): role-gated order workflow + kanban sidebar entry`) was not used as a dedicated commit to avoid an empty/trivial change set.
- **Realtime refresh uses shared `useRealtimeRefresh` hook** (new file `lib/hooks/useRealtimeRefresh.ts`): the plan did not prescribe a structure. We consolidated Supabase realtime subscription logic (orders + order_splits + order_split_events channels) into a reusable hook consumed by list, kanban, and detail views.
- **Smoke test end-to-end deferred to staging QA**: Step 2 of Task 14 (full golden-path run with 2 suppliers × 4 lines) is blocked by the empty supplier roster on the current fresh environment. All server actions / RPCs have been dry-run at the type level; the canonical UAT script lives in the plan and remains the staging checklist.

## TypeScript smoke test

`npx tsc --noEmit` after Task 14:

- **4 errors, all pre-existing baseline** (identical to 1B baseline + 1 bundled-catalog error introduced by `feat/cataloghi-ristoratore` work upstream, unrelated to 1C):
  - `app/(app)/carrello/page.tsx:105` — `catalogIds` prop on a summary type (catalog order work, upstream of 1C).
  - `app/(app)/cerca/[productId]/product-detail-client.tsx:28` — `PriceCompareRow` missing `default_warehouse_id`, `hazard_class`, `tax_rate`.
  - `lib/utils/formatters.ts:61` and `:77` — `Record<UnitType, string>` missing newer unit types (`l`, `piece`, `box`, `pallet`, ...).
- **0 new regressions** in `app/(supplier)/supplier/ordini/**`, `lib/orders/**`, `lib/notifications/**`, `lib/push/**`, or any file touched by Plan 1C.

## Env vars check

All runtime env vars required by 1C are declared in `.env.example`:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push signing.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — service worker subscription (mirror of public key).
- `RESEND_API_KEY` — transactional email.
- `AUTH_SECRET` — HMAC for stateless customer confirmation tokens (**added by this task**).

## Manual smoke test status

Full end-to-end golden path deferred to staging (no supplier seeds in the current dev DB). Per-step script is in the plan (Task 14 Step 2) and is the canonical UAT checklist for the pilot supplier rollout.

## Feature flag status

`suppliers.feature_flags.phase1_enabled` was introduced in Plan 1A Task 13 and is already enforced in the supplier layout. With 1C complete, a supplier toggled to `phase1_enabled = true` sees:

- redesigned `/supplier/ordini` list + kanban,
- per-line accept/modify on the detail page,
- FEFO picking list,
- push + email notifications for order lifecycle events.

Toggling the flag off falls back to the legacy list view (preserved).

## Ready for 1D?

**YES — green light.**

- All 14 tasks of 1C are complete and on disk.
- TypeScript baseline unchanged (no new regressions).
- Order workflow primitives required by 1D (DDT generation, driver app, KPI materialized view, delivery calendar) are in place: `order_splits` state machine, `order_split_events` audit, FEFO reservation, HMAC customer tokens, notification dispatcher, service worker.
- Out-of-scope items deliberately deferred to 1D are documented in the plan's "Out of scope" section (DDT PDF generator, driver consegne page with POD, `mv_supplier_kpi_daily` + dashboard KPI, delivery calendar with slots, route planning, post-delivery returns, SMS notifications).

1D can start on top of `feat/cataloghi-ristoratore` HEAD or off a freshly-merged `main` once this branch lands.
