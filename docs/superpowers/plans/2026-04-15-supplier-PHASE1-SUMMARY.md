# Fase 1 — Supplier MVP: Phase Completion Summary

**Branch:** `feat/cataloghi-ristoratore`
**Date range:** 2026-04-15
**Spec:** `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md`
**Sub-plans:** 1A · 1B · 1C · 1D

## Scope

Fase 1 trasforma l'area supplier da prototipo a MVP produttivo. Copre: identity & RBAC (supplier_members), magazzini multipli con FEFO, workflow ordini per-linea con conferma cliente HMAC, DDT elettronici con numerazione atomica, consegne mobile con POD firmato, dashboard KPI materializzata.

## Sub-phase matrix

| Sub-phase | Focus                                        | Tasks | Plan SUMMARY                                                   |
| --------- | -------------------------------------------- | ----- | -------------------------------------------------------------- |
| **1A**    | Fondamenta: RBAC, staff, feature flag, listini | 14    | `2026-04-15-supplier-fase1a-SUMMARY.md`                        |
| **1B**    | Magazzino: FEFO, carichi, movimenti, alert   | 10    | `2026-04-15-supplier-fase1b-SUMMARY.md`                        |
| **1C**    | Ordini: workflow, kanban, picking, push/email | 14    | `2026-04-15-supplier-fase1c-SUMMARY.md`                        |
| **1D**    | DDT / Consegne / Dashboard                    | 14    | `2026-04-15-supplier-fase1d-SUMMARY.md`                        |
| **Total** |                                              | **52** |                                                              |

## Commit inventory (Fase 1)

### 1A — Fondamenta (14 task)

- `02edd8b` migration phase1 foundations
- `2fb3c4f` database types aggiornati
- `e75eb23` permissions / feature flag / supplier context helpers
- `fa86d31` sales_units schemas + server actions
- `f6c7473` RoleGate + FeatureFlagGate
- `62f8055` catalog product detail + sales units editor
- `cd3d827` products.price backward-compat trigger
- `514a1d4` pricing (listini) schemas + actions
- `3d75612` staff schemas + actions
- `2aee770` warehouses schemas + actions + sedi UI
- `1488406` staff UI + invite acceptance
- `91e021c` listini list + editor UI
- (Task 13 phase1_enabled DB enable — bundled in earlier commits)
- `a2c295d` docs SUMMARY 1A

### 1B — Magazzino (10 task)

- `f929bf2` FEFO allocator + unit tests
- `652b802` WarehouseSwitcher + magazzino shell
- `a718525` migration low_stock + mv_stock_at_risk
- `fffc285` stock schemas + server actions
- `8afcfc5` magazzino overview
- `a96dfa5` inventario adjustment
- `bd0f820` magazzino movimenti audit
- `767890f` carichi list + new carico
- `e463a41` stock alert banner + dashboard link
- `f177341` docs SUMMARY 1B

### 1C — Ordini (14 task)

- `fff321f` deps web-push/resend + env vars
- `139d035` migration orders workflow indexes + RPC
- `8d8022f` Service Worker + push subscription
- `e5014f1` FEFO stock reservation
- `55bae84` notifications dispatcher + event helpers
- `e3a50a8` submitOrder server action (RPC)
- `6c2635e` accept/reject actions + HMAC customer token
- `da19197` orders list workflow filters
- `d0c7875` customer confirmation page
- `cc8f885` kanban drag & drop
- `93844f1` order detail per-line + timeline
- `381ef62` picking list FEFO (warehouse)
- `2020849` realtime + sidebar + permission gating
- `71bb1eb` docs SUMMARY 1C

### 1D — DDT / Consegne / Dashboard (14 task)

- `349e66a` deps React-PDF + signature canvas
- `cc5aebc` migration KPI MV + storage buckets
- `6853aa4` KPI queries + dashboard alert banner
- `3e753ff` delivery zones editor
- `f7975d3` DDT template editor
- `6711570` DDT numbering RPC + PDF renderer
- `79ae9e3` generateDdtForDelivery + COPIA reprint
- `60f7188` dashboard revenue + top clients/products + recent deliveries
- `8285624` delivery day view + driver filter
- `572c0a7` mobile delivery detail + signature + POD
- `04a7851` auto-gen DDT on loaded + sidebar
- `92c8f0c` DDT book list + detail + reprint/cancel
- (Task 13 sidebar gating — assorbito in `04a7851` / `92c8f0c`)
- (this) docs SUMMARY 1D + PHASE1 + `phase1_enabled` neutralization

**Totale commit supplier-1x:** ~48 commit su `feat/cataloghi-ristoratore` (esclusi merge + docs extra).

## Deliverable per sub-phase

### 1A — Fondamenta
- RBAC supplier (owner / sales / warehouse / driver / accountant) con `supplier_members`.
- Feature flag `suppliers.feature_flags.phase1_enabled` (rimosso in 1D Task 14).
- Gestione staff + inviti.
- Warehouses multi-sede + warehouse switcher globale.
- Listini (price lists) con regole per cliente/categoria.
- Sales units (conversioni cartone/bottiglia/pallet).

### 1B — Magazzino FEFO
- Lotti con scadenza (`stock_lots`) + allocator FEFO testato unit.
- MV `mv_stock_at_risk` per alert scadenze e low stock.
- Carichi (receive goods), inventari (adjustment), movimenti (audit).
- Dashboard alert banner low stock + expiring.

### 1C — Ordini Workflow
- Submit ordine esplicito via RPC + riserva stock FEFO transazionale.
- Accettazione per linea con `order_splits` state machine.
- Kanban drag&drop (`@dnd-kit`).
- Picking list FEFO per warehouse.
- Conferma cliente con HMAC token stateless.
- Push notifications (VAPID) + email (Resend).
- Realtime refresh (`useRealtimeRefresh` hook Supabase channel).

### 1D — DDT / Consegne / Dashboard
- DDT template editor + React-PDF renderer.
- Numerazione DDT atomica via RPC (`generate_ddt_number`).
- Auto-generazione DDT su transizione `loaded`.
- COPIA reprint con numerazione audited.
- Delivery day view + filtri per autista/zona.
- Mobile delivery detail: firma touch canvas, POD upload, geolocation.
- DDT book (registro fiscale) con cancel + reason.
- Dashboard KPI basata su `mv_supplier_kpi_daily` (cron 15 min).
- Delivery zones + CAP ranges + slot orari.

## Architecture highlights

- **Database:** 20+ migration Fase 1 (foundations → phase1d). Materialized views per performance (`mv_stock_at_risk`, `mv_supplier_kpi_daily`). RPC atomici per numerazione DDT e reserve/pick stock.
- **Storage:** buckets `ddt-assets` (PDF pubblici firmati) e `pod-signatures` (POD privati RLS-gated per supplier_id).
- **Realtime:** hook condiviso `useRealtimeRefresh` su canali `orders` / `order_splits` / `order_split_events` / `deliveries`.
- **Auth:** supplier_members con `is_active` + `accepted_at`, invite flow via email.
- **Notifications:** dispatcher notifica push + email + in-app con 404/410 cleanup per push scadute.

## TypeScript baseline

4 errori pre-esistenti (catalog order + formatters) invariati attraverso tutto Fase 1. 0 regressioni introdotte dai 52 task.

## Deferred / Out of scope

Riferimenti dai plan individuali:
- Full UAT end-to-end (richiede seed staging) — 1C §14, 1D §14.
- Build pieno Next.js — eseguito ad-hoc, non in ogni SUMMARY per vincoli ambiente.
- SMS notifications — 1C out-of-scope.
- Route planning / optimization consegne — 1D out-of-scope (Fase 3).
- Post-delivery returns (resi) — Fase 2.
- Rimozione fisica di `<FeatureFlagGate>` e `isPhase1Enabled` — Fase 2.

## Next: Fase 2+

### Fase 2 — Advanced operations
- Resi e note di credito.
- Fatturazione elettronica (SDI integration) con generazione XML da DDT.
- Contratti quadro e prezzi negoziati a lungo termine.
- Pulizia feature flag residui (rimozione `<FeatureFlagGate>` + `isPhase1Enabled`).

### Fase 3 — Optimization & scale
- Route planning consegne (ottimizzazione multi-stop).
- Previsione domanda (ARIMA/ML) su `mv_supplier_kpi_daily`.
- Multi-deposito advanced (transfer automatici tra warehouses).
- Integrazione WMS esterno (barcode scanner).

### Fase 4 — Marketplace features
- Cataloghi condivisi multi-supplier.
- Procurement bid (richieste preventivi RFQ).
- Rating/reputazione supplier pubblica.

### Fase 5 — Analytics & data
- Data warehouse (Supabase → BigQuery/Clickhouse).
- Report personalizzabili (cliente, categoria, margine).
- API pubblica read-only per ERP integration.

## Phase 1 status

**COMPLETE — MVP Supplier consegnato.**

Prossimo passo operativo: merge `feat/cataloghi-ristoratore` → `main`, deploy staging, UAT pilota (supplier single-tenant), rollout graduale (1 → 5 → N) anche senza feature flag grazie a policy RLS e RBAC granulari.
