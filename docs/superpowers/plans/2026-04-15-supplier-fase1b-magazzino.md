# Fornitore Fase 1B — Magazzino + Lotti FEFO + Tracciabilità — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** costruire l'area Magazzino dell'admin fornitore: overview giacenze per warehouse, gestione lotti con FEFO e scadenze, carichi con alert costo anomalo, rettifica inventariale, audit log movimenti, alert sottoscorta e scadenze in arrivo. Questo è il secondo dei 4 plan sequenziali di Fase 1 (spec §13).

**Dipendenza:** il plan 1A (Fondamenta & Catalogo pro) deve essere già mergato — tabelle `warehouses`, `stock_lots`, `stock_movements`, `supplier_members`, `product_sales_units`, enum `stock_movement_type`, helper RPC `is_supplier_member` / `has_supplier_permission`, seed `role_permissions` sono già in produzione.

**Architettura:** pura business logic per il FEFO allocator in `lib/supplier/stock/fefo.ts` (testabile in isolamento, senza framework — `node --test` nativo se disponibile, altrimenti assert inline). UI sotto `app/(supplier)/supplier/magazzino/*` come server components con client islands. Server actions in `lib/supplier/stock/actions.ts` con Zod + `has_supplier_permission` pre-check + RLS come gate finale. Una migrazione additiva per `products.low_stock_threshold` e la view materializzata `mv_stock_at_risk` (spec §3.4).

**Tech Stack:** Next.js 15 (App Router) · Supabase SSR · TypeScript strict · Tailwind v4 (dark-dashboard tokens) · Zod v4 · lucide-react · sonner (toasts) · `node --test` (fallback: asserzioni manuali) per le unit del FEFO.

**Reference spec:** `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md` (sezioni chiave: §3.1 `stock_lots`/`stock_movements`, §3.4 `mv_stock_at_risk`, §5.4 carico, §6.3 codici colore scadenze, §7.5 pattern server action, §7.6 concorrenza).

**Testing model:** il progetto non ha framework di test configurato. Il FEFO allocator, essendo pura business logic, riceve unit test in `lib/supplier/stock/fefo.test.ts` eseguibili con `node --test` nativo (Node ≥18) — se non disponibile nella toolchain verificata al Task 1, fallback a `node <file>` con `assert` inline. Per tutto il resto (UI, server actions) ogni task termina con **manual verification steps**. Nessun'automazione E2E.

**Conventions (follow existing code):**
- Server actions in `lib/supplier/<area>/actions.ts` con direttiva `"use server"`; ritornano `{ ok: true; data } | { ok: false; error: string }`.
- Supabase browser: `createClient()` da `@/lib/supabase/client`. Server: `createClient()` da `@/lib/supabase/server`.
- UI strings in italiano.
- Dark-dashboard tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `accent-green`, `accent-amber`, `accent-red`, `accent-yellow`). Se mancano varianti colore, aggiungerle in `app/globals.css` riusando il pattern esistente.
- Riuso `DarkCard` e primitive già presenti in `components/dashboard/` e `components/supplier/shared/` (create in 1A).
- Toasts via `sonner`. Icone `lucide-react` (verificare che l'icona esista prima dell'uso).
- Tutte le mutation passano da `has_supplier_permission` RPC (permessi `stock.read`, `stock.receive`, `stock.adjust` — già seedati in 1A).

---

## File Structure

### Created
- `supabase/migrations/20260418000001_phase1b_stock_alerts.sql`
- `lib/supplier/stock/fefo.ts` — pura allocazione FEFO
- `lib/supplier/stock/fefo.test.ts` — unit test FEFO
- `lib/supplier/stock/schemas.ts` — Zod (`ReceiveLotSchema`, `AdjustStockSchema`, `ListMovementsFilterSchema`)
- `lib/supplier/stock/types.ts` — tipi derivati + row types
- `lib/supplier/stock/queries.ts` — helper server-only per fetch giacenze/lotti/movimenti
- `lib/supplier/stock/actions.ts` — server actions (`receiveLot`, `adjustStock`, `listMovements`)
- `app/(supplier)/supplier/magazzino/page.tsx` — overview giacenze
- `app/(supplier)/supplier/magazzino/overview-client.tsx`
- `app/(supplier)/supplier/magazzino/lotti/page.tsx` — tabella lotti FEFO
- `app/(supplier)/supplier/magazzino/lotti/lots-client.tsx`
- `app/(supplier)/supplier/magazzino/carichi/page.tsx` — lista carichi recenti
- `app/(supplier)/supplier/magazzino/carichi/nuovo/page.tsx`
- `app/(supplier)/supplier/magazzino/carichi/nuovo/receive-form-client.tsx`
- `app/(supplier)/supplier/magazzino/inventario/page.tsx` — rettifica inventariale
- `app/(supplier)/supplier/magazzino/inventario/adjust-client.tsx`
- `app/(supplier)/supplier/magazzino/movimenti/page.tsx` — audit log
- `app/(supplier)/supplier/magazzino/movimenti/movements-client.tsx`
- `components/supplier/shared/warehouse-switcher.tsx`
- `components/supplier/inventory/stock-overview-table.tsx`
- `components/supplier/inventory/lot-row.tsx`
- `components/supplier/inventory/expiry-badge.tsx`
- `components/supplier/inventory/low-stock-banner.tsx`

### Modified
- `app/(supplier)/supplier/layout.tsx` — voce "Magazzino" già presente da 1A: aggiungere sotto-voci (Giacenze/Lotti/Carichi/Inventario/Movimenti) e badge contatore alert
- `types/database.ts` — rigenerare per includere `low_stock_threshold` e `mv_stock_at_risk`

---

## Task 1 — Migrazione 1B: `low_stock_threshold` + `mv_stock_at_risk`

**Files:**
- Create: `supabase/migrations/20260418000001_phase1b_stock_alerts.sql`
- Modify: `types/database.ts` (rigenerato)

Riferimento spec: §3.2 (campi `products`) e §3.4 (view materializzata).

- [ ] **Step 1: Scrivere la migrazione**

```sql
-- Phase 1B — low-stock threshold per prodotto + view materializzata alert scadenze

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NULL
  CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0);

COMMENT ON COLUMN products.low_stock_threshold IS
  'Soglia (in unita base) sotto la quale scatta alert stock_low. NULL = alert disattivato.';

-- View materializzata: lotti con scadenza <=60gg o prodotti sottoscorta
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stock_at_risk AS
SELECT
  w.supplier_id,
  sl.product_id,
  sl.warehouse_id,
  sl.id            AS lot_id,
  sl.lot_code,
  sl.expiry_date,
  (sl.expiry_date - CURRENT_DATE)::int AS days_to_expiry,
  sl.quantity_base,
  sl.quantity_reserved_base
FROM stock_lots sl
JOIN warehouses w ON w.id = sl.warehouse_id
WHERE sl.quantity_base > 0
  AND sl.expiry_date IS NOT NULL
  AND sl.expiry_date <= CURRENT_DATE + INTERVAL '60 days';

CREATE UNIQUE INDEX IF NOT EXISTS mv_stock_at_risk_lot_id
  ON mv_stock_at_risk(lot_id);
CREATE INDEX IF NOT EXISTS mv_stock_at_risk_supplier
  ON mv_stock_at_risk(supplier_id, days_to_expiry);

-- Refresh helper (chiamato dopo carico/rettifica/scarico)
CREATE OR REPLACE FUNCTION refresh_mv_stock_at_risk()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_at_risk;
$$;

GRANT EXECUTE ON FUNCTION refresh_mv_stock_at_risk() TO authenticated;
```

- [ ] **Step 2: Applicare la migrazione**

```bash
npx supabase db push
```

Expected: migration applicata senza errori; `SELECT * FROM mv_stock_at_risk LIMIT 1;` in Studio deve restituire riga vuota (nessun lotto ancora in scadenza nel seed).

- [ ] **Step 3: Rigenerare types**

```bash
npx supabase gen types typescript --local > types/database.ts
```

Verificare che `products.low_stock_threshold` e `mv_stock_at_risk` (come view) appaiano.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418000001_phase1b_stock_alerts.sql types/database.ts
git commit -m "feat(db): phase1b low_stock_threshold + mv_stock_at_risk view"
```

---

## Task 2 — FEFO allocator: pura business logic + unit test

**Files:**
- Create: `lib/supplier/stock/fefo.ts`
- Create: `lib/supplier/stock/fefo.test.ts`
- Create: `lib/supplier/stock/types.ts`

Riferimento spec: §3.1 indice FEFO, §5.2 workflow picking. L'allocator in 1B è **solo funzione pura**: l'uso concreto durante picking arriva in 1C.

- [ ] **Step 1: Definire tipi in `types.ts`**

```ts
export type LotCandidate = {
  id: string;
  productId: string;
  warehouseId: string;
  lotCode: string;
  expiryDate: string | null; // ISO date yyyy-mm-dd
  receivedAt: string;        // ISO timestamp
  quantityBase: number;
  quantityReservedBase: number;
};

export type FefoAllocation = {
  lotId: string;
  quantityBase: number;
};

export type FefoResult =
  | { ok: true; allocations: FefoAllocation[] }
  | { ok: false; reason: "insufficient_stock"; shortBy: number; allocations: FefoAllocation[] };
```

- [ ] **Step 2: Scrivere `fefo.ts` (funzione pura)**

Regole:
1. Filtra lotti con `available = quantityBase - quantityReservedBase > 0`.
2. Ordina per `expiryDate` ascendente (null = tratta come infinito/last), tiebreak `receivedAt` asc (FIFO intra-scadenza).
3. Alloca greedy fino a coprire `requestedBase`. Se multi-lotto necessario, spezza.
4. Se stock totale insufficiente, ritorna `ok: false` con allocazioni parziali e `shortBy`.

Firma: `export function allocateFefo(lots: LotCandidate[], requestedBase: number): FefoResult`.

- [ ] **Step 3: Scrivere `fefo.test.ts`**

Coprire almeno:
- singolo lotto copre tutto
- due lotti stessa scadenza, tiebreak `receivedAt`
- scadenza più vicina prima anche se quantità maggiore altrove
- multi-lotto (richiesta > singolo lotto ma totale sufficiente)
- stock insufficiente → `ok:false`, `shortBy` corretto, allocazioni parziali consistenti
- lotto con `expiryDate = null` (non deperibile) posticipato rispetto a lotti con scadenza
- `requestedBase = 0` → `ok:true`, allocazioni vuote
- `quantityReservedBase` riduce correttamente il disponibile

Usare `node:test` + `node:assert/strict`. Esempio scaffold:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateFefo } from "./fefo";

test("alloca dal lotto con scadenza piu vicina", () => {
  const result = allocateFefo(
    [
      { id: "a", productId: "p", warehouseId: "w", lotCode: "A",
        expiryDate: "2026-06-01", receivedAt: "2026-04-01T00:00:00Z",
        quantityBase: 10, quantityReservedBase: 0 },
      { id: "b", productId: "p", warehouseId: "w", lotCode: "B",
        expiryDate: "2026-05-01", receivedAt: "2026-04-02T00:00:00Z",
        quantityBase: 5, quantityReservedBase: 0 },
    ],
    4,
  );
  assert.deepEqual(result, { ok: true, allocations: [{ lotId: "b", quantityBase: 4 }] });
});
```

- [ ] **Step 4: Eseguire i test**

```bash
node --test --import tsx lib/supplier/stock/fefo.test.ts
```

Se la toolchain non ha `tsx` disponibile in dev, fallback: compilare con `npx tsc --noEmit` per verificare solo tipi, e spostare i test in un file `.mjs` con `assert` inline.

Expected: tutti i test passano.

- [ ] **Step 5: Commit**

```bash
git add lib/supplier/stock/
git commit -m "feat(supplier): pure FEFO allocator with unit tests"
```

---

## Task 3 — Schemi Zod + server actions stock

**Files:**
- Create: `lib/supplier/stock/schemas.ts`
- Create: `lib/supplier/stock/queries.ts`
- Create: `lib/supplier/stock/actions.ts`

Riferimento spec: §5.4 carico, §7.5 pattern server action, §7.6 lock.

- [ ] **Step 1: Schemi Zod in `schemas.ts`**

```ts
import { z } from "zod";

export const ReceiveLotSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  salesUnitId: z.string().uuid(),
  quantitySalesUnit: z.number().positive(),
  lotCode: z.string().min(1).max(80),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  costPerBase: z.number().nonnegative().nullable(),
  notes: z.string().max(500).optional(),
});

export const AdjustStockSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  lotId: z.string().uuid().nullable(),
  deltaBase: z.number().refine((n) => n !== 0, "delta non puo essere 0"),
  reason: z.string().min(3).max(300),
});

export const ListMovementsFilterSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  movementType: z.enum([
    "receive","order_reserve","order_unreserve","order_ship",
    "adjust_in","adjust_out","return","transfer",
  ]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});
```

- [ ] **Step 2: `queries.ts` (server-only)**

Fornire helper puri su Supabase server client:
- `getWarehousesForCurrentMember(supplierId)`
- `getStockOverview(supplierId, warehouseId?)` — aggregato per prodotto: `sum(quantity_base)`, `sum(quantity_reserved_base)`, available, `low_stock_threshold`, flag `isLow`.
- `getLots(supplierId, { warehouseId?, productId?, onlyWithStock? })` ordinati secondo indice FEFO.
- `getMovements(filter)` con join a `products`, `supplier_members`.
- `getCostHistory(productId, warehouseId)` → ultimi 10 `cost_per_base` da `stock_lots` dove type=`receive`, per calcolare la media del check anomalo.

Tutti richiamano `supabase.rpc("has_supplier_permission", { p_supplier_id, p_permission: "stock.read" })` come pre-check.

- [ ] **Step 3: `actions.ts` — `receiveLot`**

Pattern (spec §7.5):
1. `getUser()` o throw.
2. Zod parse (`ReceiveLotSchema`).
3. `has_supplier_permission(supplierId, "stock.receive")` → se false ritorna `{ ok:false, error:"permessi insufficienti" }`.
4. Fetch `product_sales_units` per `salesUnitId` → calcola `quantityBase = quantitySalesUnit * conversion_to_base`.
5. Alert costo anomalo: `costPerBase` confrontato con media `getCostHistory`: se `|delta| > 15%` **non blocca** ma ritorna `warning: "costo_anomalo"` nel payload per UI (spec §5.4).
6. Transazione via `supabase.rpc("receive_lot_tx", {...})` (helper SQL da creare nel Task 3.5) che in un'unica transazione inserisce `stock_lots` e `stock_movements` type=`receive`, poi chiama `refresh_mv_stock_at_risk`.
7. Ritorna `{ ok: true, data: { lotId, warning? } }`.

- [ ] **Step 4: `actions.ts` — `adjustStock`**

Usa `AdjustStockSchema`, permesso `stock.adjust`.
- Se `deltaBase > 0`: movimento `adjust_in`, crea un nuovo `stock_lots` (senza expiry se non fornito) oppure incrementa `lotId` se fornito.
- Se `deltaBase < 0`: movimento `adjust_out`, decrementa `stock_lots.quantity_base` con `SELECT ... FOR UPDATE` (spec §7.6). Se `lotId` nullo, applica FEFO tramite `allocateFefo`.
- Scrive `reason` in `stock_movements.notes`.
- Refresh view a fine transazione.

- [ ] **Step 5: `actions.ts` — `listMovements`**

Server action (o semplice async function esposta a server component) che parse filter e ritorna righe paginate. Nessuna mutation.

- [ ] **Step 6: Helper SQL transazionali**

Aggiungere nella stessa migrazione del Task 1 (o creare follow-up `20260418000002_stock_tx_helpers.sql`):

```sql
CREATE OR REPLACE FUNCTION receive_lot_tx(
  p_product_id uuid, p_warehouse_id uuid, p_lot_code text,
  p_expiry_date date, p_quantity_base numeric, p_cost_per_base numeric,
  p_member_id uuid, p_notes text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_lot_id uuid;
BEGIN
  INSERT INTO stock_lots(product_id, warehouse_id, lot_code, expiry_date,
                         quantity_base, cost_per_base, received_at, notes)
  VALUES (p_product_id, p_warehouse_id, p_lot_code, p_expiry_date,
          p_quantity_base, p_cost_per_base, now(), p_notes)
  RETURNING id INTO v_lot_id;

  INSERT INTO stock_movements(product_id, lot_id, warehouse_id, quantity_base,
                              movement_type, created_by_member_id, notes)
  VALUES (p_product_id, v_lot_id, p_warehouse_id, p_quantity_base,
          'receive', p_member_id, p_notes);

  RETURN v_lot_id;
END $$;
```

(e analogo `adjust_stock_tx` per le rettifiche con `FOR UPDATE`). Se si sceglie di aggiungere un file migration separato, anticiparlo prima del Task 1 di verifica UI.

- [ ] **Step 7: Manual verification**

Da Supabase Studio SQL editor, chiamare `receive_lot_tx` come utente service — verificare che la riga appaia in `stock_lots` e `stock_movements` e che `mv_stock_at_risk` si aggiorni se expiry ≤60gg.

- [ ] **Step 8: Commit**

```bash
git add lib/supplier/stock/ supabase/migrations/
git commit -m "feat(supplier): stock server actions with zod + permission check"
```

---

## Task 4 — `<WarehouseSwitcher>` condiviso + layout magazzino

**Files:**
- Create: `components/supplier/shared/warehouse-switcher.tsx`
- Modify: `app/(supplier)/supplier/layout.tsx`

Riferimento spec: §6.1 (switcher visibile solo se `maturityLevel === "advanced"` o `warehouses.length > 1`).

- [ ] **Step 1: Componente switcher**

Client component che:
- Riceve `warehouses: {id,name,isPrimary}[]` e `currentWarehouseId`.
- Rende `<select>` dark-dashboard style; al change aggiorna `?warehouse=<id>` in URL via `router.replace` con `scroll:false`.
- Se lista ha 1 elemento → restituisce `null`.
- Espone anche `<WarehouseSwitcherServer>` wrapper che fetcha warehouses server-side e passa giù.

- [ ] **Step 2: Integrare nel layout magazzino**

Aggiungere sotto-nav in `app/(supplier)/supplier/layout.tsx` (o in un sub-layout `magazzino/layout.tsx` se più pulito): tab orizzontale con "Giacenze / Lotti / Carichi / Inventario / Movimenti" + `<WarehouseSwitcher>` a destra. Evidenziare tab attivo con `accent-green`.

- [ ] **Step 3: Manual verification**

- Login come fornitore con 1 warehouse → switcher nascosto.
- Creare a mano un 2° warehouse in Studio → ricaricare → switcher visibile, change URL aggiorna query param.

- [ ] **Step 4: Commit**

```bash
git add components/supplier/shared/warehouse-switcher.tsx app/(supplier)/supplier/layout.tsx
git commit -m "feat(supplier): warehouse switcher and inventory sub-nav"
```

---

## Task 5 — `/supplier/magazzino` overview giacenze

**Files:**
- Create: `app/(supplier)/supplier/magazzino/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/overview-client.tsx`
- Create: `components/supplier/inventory/stock-overview-table.tsx`
- Create: `components/supplier/inventory/low-stock-banner.tsx`

- [ ] **Step 1: Server page**

- Legge `searchParams.warehouse`.
- Chiama `getStockOverview(supplierId, warehouseId)` + `getWarehousesForCurrentMember`.
- Passa al client component.
- Se `products` vuoto → empty state con CTA "Registra primo carico" → link `/supplier/magazzino/carichi/nuovo`.

- [ ] **Step 2: `<StockOverviewTable>`**

Colonne: Prodotto | SKU | Warehouse (se no switcher) | Giacenza base | Riservato | Disponibile | Soglia | Stato. Righe sottoscorta evidenziate con `bg-accent-red/10` e badge "Sotto scorta". Ordinamento client-side su tutte le colonne; ricerca full-text `name+sku`.

- [ ] **Step 3: `<LowStockBanner>`**

Se `items.filter(i => i.isLow).length > 0`, mostra banner arancione in cima con "N prodotti sotto scorta — [Vedi tutti]" filtro veloce.

- [ ] **Step 4: Manual verification**

- Impostare `low_stock_threshold = 100` su un prodotto con giacenza `50` → banner appare + riga evidenziata.
- Switch warehouse aggiorna tabella.

- [ ] **Step 5: Commit**

```bash
git add app/(supplier)/supplier/magazzino/page.tsx app/(supplier)/supplier/magazzino/overview-client.tsx components/supplier/inventory/
git commit -m "feat(supplier): stock overview page with low-stock alerts"
```

---

## Task 6 — `/supplier/magazzino/lotti` — tabella lotti con semafori scadenza

**Files:**
- Create: `app/(supplier)/supplier/magazzino/lotti/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/lotti/lots-client.tsx`
- Create: `components/supplier/inventory/expiry-badge.tsx`
- Create: `components/supplier/inventory/lot-row.tsx`

Riferimento spec: §6.3.8 codici colore (rosso scaduto, ambra ≤7gg, giallo ≤30gg, neutro altro).

- [ ] **Step 1: `<ExpiryBadge>`**

Pura presentazione: riceve `expiryDate: string | null`, calcola `daysToExpiry`:
- `< 0` → `bg-accent-red/20 text-accent-red`, label "Scaduto".
- `≤ 7` → `bg-accent-amber/20 text-accent-amber`, label "N giorni".
- `≤ 30` → `bg-accent-yellow/20 text-accent-yellow`.
- altro / null → `bg-surface-hover text-text-muted`, label data oppure "—".

Assicurarsi che i token `accent-amber` e `accent-yellow` esistano in `globals.css`; se no aggiungerli (HSL coerenti col resto).

- [ ] **Step 2: Server page lotti**

Fetch `getLots(supplierId, { warehouseId })` ordinato FEFO. Colonne: Prodotto | Warehouse | Lotto | Scadenza (badge) | Ricevuto il | Qty base | Riservato | Disponibile | Costo/base | Note.

Filtri client (query string):
- `q` — ricerca su prodotto/lot_code
- `expiring` — `all | expired | 7 | 30`
- `warehouse` — condiviso con switcher

- [ ] **Step 3: Evidenza visiva**

Righe scadute → `opacity-70` + border rosso. Righe `≤ 7gg` → sfondo sottile ambra.

- [ ] **Step 4: Manual verification**

Inserire manualmente in Studio 3 lotti con scadenze `yesterday`, `today+5`, `today+20` → verifica colori e ordinamento FEFO.

- [ ] **Step 5: Commit**

```bash
git add app/(supplier)/supplier/magazzino/lotti/ components/supplier/inventory/expiry-badge.tsx components/supplier/inventory/lot-row.tsx
git commit -m "feat(supplier): lots table with FEFO sorting and expiry badges"
```

---

## Task 7 — `/supplier/magazzino/carichi` e form nuovo carico

**Files:**
- Create: `app/(supplier)/supplier/magazzino/carichi/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/carichi/nuovo/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/carichi/nuovo/receive-form-client.tsx`

Riferimento spec: §5.4.

- [ ] **Step 1: Lista carichi**

Server page che query `stock_movements WHERE movement_type='receive'` con join prodotto/warehouse/member. Colonne: Data | Prodotto | Warehouse | Lotto | Qty base | Costo/base | Operatore | Note. Filtro periodo (default ultimi 30gg) + CTA "Nuovo carico".

- [ ] **Step 2: Form `receive-form-client.tsx`**

Client component. Campi:
- Warehouse (preselect primary, dropdown se >1)
- Prodotto (combobox con ricerca server su `products` del supplier — riusare pattern dal catalogo 1A)
- Sales unit (dropdown popolato dopo selezione prodotto, default unità base)
- Quantità (sales unit) + preview auto `= N unità base` dal `conversion_to_base`
- Lot code (text, autofocus dopo prodotto)
- Data scadenza (date input opzionale)
- Costo per unità base (numero opzionale)
- Note (textarea opzionale)

Flow:
1. Al cambio del costo, chiamata a `getCostHistory` → mostra inline la media e delta %. Se `|delta| > 15%` banner giallo "Costo anomalo rispetto alla media (X €/base). Confermi?" senza bloccare submit.
2. Submit → `receiveLot` server action. Toast successo → `router.push("/supplier/magazzino/carichi")` e `router.refresh()`.
3. Shortcut `Cmd/Ctrl+Enter` per submit rapido.

- [ ] **Step 3: Validazione inline**

Errori Zod mostrati sotto al campo. Disable submit su invalid.

- [ ] **Step 4: Manual verification**

- Carico nuovo lotto con costo coerente → ok, riga in `carichi` + `lotti`.
- Carico con costo +30% → banner giallo appare ma submit funziona.
- Tentare submit con quantità negativa → errore Zod.

- [ ] **Step 5: Commit**

```bash
git add app/(supplier)/supplier/magazzino/carichi/
git commit -m "feat(supplier): stock receive form with cost anomaly alert"
```

---

## Task 8 — `/supplier/magazzino/inventario` — rettifica inventariale

**Files:**
- Create: `app/(supplier)/supplier/magazzino/inventario/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/inventario/adjust-client.tsx`

Riferimento spec: §3.1 `stock_movements` type `adjust_in/out`.

- [ ] **Step 1: Server page**

Due tab:
- **Rettifica rapida** (default) — form singolo: Warehouse, Prodotto, Lotto opzionale, Δ in unità base (±), Motivo (required).
- **Inventario fisico** (semplice) — tabella prodotti warehouse con colonna "Giacenza sistema", input "Giacenza contata", calcolo Δ in tempo reale, submit bulk.

Nota: l'inventario fisico bulk può chiamare `adjustStock` in serie (Promise.all con cap di 10 concorrenti). Ogni riga con Δ ≠ 0 genera un movimento.

- [ ] **Step 2: Permessi**

Precheck `has_supplier_permission(..., "stock.adjust")` lato server page: se false, rendering pagina di avviso "Permesso stock.adjust mancante" senza form.

- [ ] **Step 3: Manual verification**

- Rettifica rapida −5 su lotto con 10 → lotto passa a 5, movimento `adjust_out` creato.
- Inventario fisico: contato 8 dove sistema dice 10 → submit → movimento `adjust_out` con Δ=−2.
- Login con ruolo `sales` (no `stock.adjust`) → messaggio permesso negato.

- [ ] **Step 4: Commit**

```bash
git add app/(supplier)/supplier/magazzino/inventario/
git commit -m "feat(supplier): inventory adjustment with permission gate"
```

---

## Task 9 — `/supplier/magazzino/movimenti` — audit log

**Files:**
- Create: `app/(supplier)/supplier/magazzino/movimenti/page.tsx`
- Create: `app/(supplier)/supplier/magazzino/movimenti/movements-client.tsx`

- [ ] **Step 1: Server page**

Chiama `listMovements` con filtri da `searchParams`. Default ultimi 7 giorni. Colonne: Data/ora | Tipo (badge colorato) | Prodotto | Warehouse | Lotto | Qty (con segno) | Operatore | Riferimento (link a order_split se presente) | Note.

- [ ] **Step 2: Filtri client**

Query string controllati:
- `type` — enum `stock_movement_type`
- `warehouse`, `product`, `from`, `to`
- `q` — ricerca full-text su note/lot_code lato client

Paginazione "Carica altri 100" server-driven.

- [ ] **Step 3: Badge tipo movimento**

| Tipo | Colore | Label |
|---|---|---|
| receive | `accent-green` | Carico |
| order_reserve | `accent-blue` | Prenotato |
| order_unreserve | `text-muted` | Sprenotato |
| order_ship | `accent-purple` | Spedito |
| adjust_in | `accent-green/60` | Rettifica + |
| adjust_out | `accent-amber` | Rettifica − |
| return | `accent-blue/60` | Reso |
| transfer | `text-muted` | Trasferimento |

- [ ] **Step 4: Manual verification**

- Dopo Task 7/8, movimenti appaiono in audit log in ordine desc.
- Filtro `type=adjust_out` isola solo le rettifiche negative.
- Filtro periodo funziona.

- [ ] **Step 5: Commit**

```bash
git add app/(supplier)/supplier/magazzino/movimenti/
git commit -m "feat(supplier): stock movements audit log with filters"
```

---

## Task 10 — Rifinitura: banner alert globale + link da dashboard + smoke test

**Files:**
- Modify: `app/(supplier)/supplier/dashboard/page.tsx` (piccolo widget alert)
- Modify: `app/(supplier)/supplier/layout.tsx` (badge contatore su voce Magazzino)

- [ ] **Step 1: Widget dashboard "Alert magazzino"**

Card compatta nel dashboard supplier con 2 contatori:
- Prodotti sotto scorta (query: `products WHERE low_stock_threshold IS NOT NULL AND available < low_stock_threshold`).
- Lotti in scadenza ≤7gg (query: `mv_stock_at_risk WHERE days_to_expiry <= 7`).

Click → link rispettivamente a `/supplier/magazzino?filter=low` e `/supplier/magazzino/lotti?expiring=7`.

Se entrambi 0 → card mostra stato verde "Magazzino in salute".

- [ ] **Step 2: Badge sulla voce sidebar**

Se uno dei due contatori > 0, mostrare pallino rosso con totale accanto a "Magazzino" in sidebar (fetch una sola volta nel layout server).

- [ ] **Step 3: Smoke test end-to-end manuale**

1. Seed: 1 prodotto con `low_stock_threshold=10`.
2. `/magazzino/carichi/nuovo` → carica 5 unità base con scadenza tra 3 giorni → ok.
3. Dashboard → "Alert magazzino" mostra "1 sotto scorta, 1 in scadenza".
4. `/magazzino` → banner low-stock + riga evidenziata.
5. `/magazzino/lotti` → lotto con badge ambra.
6. `/magazzino/inventario` → rettifica +20 sullo stesso lotto → dashboard torna verde per sotto scorta.
7. `/magazzino/movimenti` → vedo `receive` e `adjust_in` in ordine.
8. RLS check: login da altro supplier → nessuno dei dati sopra visibile.

- [ ] **Step 4: `npm run build`**

Risolvere eventuali errori TypeScript / ESLint introdotti.

- [ ] **Step 5: Commit finale**

```bash
git add app/(supplier)/supplier/dashboard/page.tsx app/(supplier)/supplier/layout.tsx
git commit -m "feat(supplier): dashboard alerts widget and sidebar badge for stock"
```

---

## Fuori scope di 1B (rimando ai plan successivi)

- Prenotazione/scarico automatico stock in risposta a ordini confermati → **1C** (workflow ordini).
- Uso effettivo del FEFO allocator durante il picking list del magazziniere → **1C** (integrerà `allocateFefo` nella server action di preparazione).
- DDT con tracciabilità lotti → **1D**.
- Notifiche email/push per `stock_low` e `lot_expiring` → **1C** (insieme a tutta la pipeline notifiche).
- Multi-warehouse con transfer, route planner — fuori Fase 1 (Fase 3 per il transfer avanzato).
