# Fornitore Fase 1D — DDT + Consegne + Dashboard KPI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chiudere la Fase 1 del redesign area fornitore con: editor zone/calendario consegne con slot orari, vista operativa consegne del giorno per autista, dettaglio consegna mobile-first con firma canvas e POD foto, libro DDT con ricerca/filtri/ristampa, editor template DDT personalizzabili, generatore PDF DDT server-side con numerazione progressiva concorrente-safe, dashboard fornitore ridisegnata sopra `mv_supplier_kpi_daily` con alert e grafici. Al termine, il feature flag `phase1_enabled` viene rimosso come gate (default true per tutti i supplier).

**Architecture:** due migration Supabase (vista materializzata KPI + policy storage). Routing sotto `app/(supplier)/supplier/{consegne,ddt,impostazioni/zone,dashboard}`. Componenti nuovi in `components/supplier/{delivery,ddt}` seguendo la mappa §4.2 della spec. Generatore PDF server-only (`lib/supplier/ddt/render.ts`) con `@react-pdf/renderer`; upload bucket privato `ddt-pdfs` + signed URL. Firma consegna: canvas HTML client-side → PNG blob upload nel bucket `delivery-proofs`. Numerazione DDT serializzata via `pg_advisory_xact_lock(hashtext('ddt:'||supplier_id||':'||year))` dentro una server action. Dashboard sopra view materializzata `mv_supplier_kpi_daily` con refresh 15 min (pg_cron) + trigger on-demand dopo eventi critici.

**Dependencies:** richiede 1A + 1B + 1C mergiati. Da 1A: `warehouses`, `supplier_members`, `role_permissions`, helper RPC `has_supplier_permission`. Da 1B: `stock_lots`, `stock_movements`, FEFO allocator. Da 1C: `order_splits.warehouse_id`, `order_split_items`, `deliveries` (riga base), `delivery_items`, notifiche, `RoleGate`.

**Tech Stack:** Next.js 15 (App Router) · Supabase SSR · TypeScript strict · Tailwind v4 (dark-dashboard tokens) · Zod v4 · `@react-pdf/renderer` · `recharts` (sparkline + chart) · `date-fns` · `signature_pad` (libreria leggera opzionale, altrimenti canvas custom) · lucide-react · sonner.

**Reference spec:** `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md`
Sezioni chiave: §3.1 (`deliveries`, `delivery_items`, `ddt_documents`, `ddt_templates`), §3.2 (estensione `delivery_zones`), §3.4 (`mv_supplier_kpi_daily`), §5.3 (workflow consegna+DDT), §6.3-6.6 (principi UX HoReCa, mobile-first consegne, CSS print), §7.3-7.6 (RLS, storage policies, advisory lock), §8 (notifiche evento `delivery_failed`, `order_shipped`), §9 (perf dashboard).

**Testing model:** nessun framework di test automatico configurato. Ogni task termina con **passi di verifica manuale** (browser + Supabase SQL console + Studio) prima del commit. La migration `mv_supplier_kpi_daily` va validata con una query di spot-check su un supplier demo.

**Conventions (follow existing code):**
- Server actions in `lib/supplier/<domain>/actions.ts` con `"use server"`, Zod strict, `has_supplier_permission` pre-check, `getUser()`, ritornano `{ ok: true; data } | { ok: false; error: string }`.
- Supabase client: `createClient()` da `@/lib/supabase/{client,server}`.
- Tutte le stringhe UI in italiano.
- Dark-dashboard tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `accent-green`, `accent-amber`, `accent-red`, `accent-blue`) già in `globals.css`.
- Componenti riutilizzabili: `DarkCard`, `RoleGate` (introdotto in 1C), `EmptyState`, `WarehouseSwitcher` da `components/supplier/shared/`.
- Toasts via `sonner`. Icone via `lucide-react`.
- Timestamp relativi con tooltip assoluto (pattern già in uso; `formatRelative` da `date-fns/locale/it`).
- Colori stato (§6.3.7 spec): verde=ok, ambra=attesa, rosso=problema, blu=info.
- Mobile-first su tutto `/supplier/consegne/*`: tap target ≥ 44px, firma canvas fullscreen, bottoni grandi.

---

## File Structure

### Created
- `supabase/migrations/20260501000001_phase1d_kpi_and_storage.sql` — `mv_supplier_kpi_daily`, `mv_stock_at_risk`, refresh function, pg_cron schedule, storage policies per `ddt-pdfs` e `delivery-proofs`, indici per `ddt_documents(supplier_id, year, number)`.
- `lib/supplier/delivery-zones/schemas.ts` — Zod (`delivery_days int[]`, `delivery_slots jsonb`, `cutoff_time`).
- `lib/supplier/delivery-zones/actions.ts` — CRUD zone con slot.
- `lib/supplier/deliveries/schemas.ts` — Zod delivery status transitions + POD.
- `lib/supplier/deliveries/actions.ts` — `startDelivery`, `markInTransit`, `markDelivered`, `markFailed`, `uploadSignature`, `uploadPodPhoto`.
- `lib/supplier/ddt/schemas.ts` — Zod template + generazione.
- `lib/supplier/ddt/render.ts` — renderer React-PDF server-only (`"use server"` non applicabile: è un modulo chiamato da action).
- `lib/supplier/ddt/actions.ts` — `generateDdtForDelivery`, `getDdtSignedUrl`, `reprintDdtCopy`, CRUD template.
- `lib/supplier/ddt/numbering.ts` — helper `nextDdtNumber(supplierId, year)` con advisory lock.
- `lib/supplier/kpi/queries.ts` — read-only `getSupplierDailyKpi`, `getAlerts`, `getRevenueSparkline`, `getTopCustomers`, `getTopProducts`, `getRecentDeliveries`.
- `app/(supplier)/supplier/impostazioni/zone/page.tsx` — server component.
- `app/(supplier)/supplier/impostazioni/zone/zones-client.tsx` — editor calendar + slot.
- `app/(supplier)/supplier/consegne/page.tsx` — vista del giorno.
- `app/(supplier)/supplier/consegne/deliveries-day-client.tsx` — interazioni (filtro driver, ordinamento).
- `app/(supplier)/supplier/consegne/calendario/page.tsx` — vista settimanale/mensile.
- `app/(supplier)/supplier/consegne/calendario/calendar-client.tsx`.
- `app/(supplier)/supplier/consegne/[id]/page.tsx` — dettaglio mobile-first.
- `app/(supplier)/supplier/consegne/[id]/delivery-detail-client.tsx` — bottoni stato + firma.
- `app/(supplier)/supplier/ddt/page.tsx` — libro DDT.
- `app/(supplier)/supplier/ddt/ddt-book-client.tsx` — ricerca + filtri.
- `app/(supplier)/supplier/ddt/[id]/page.tsx` — anteprima + download + ristampa.
- `app/(supplier)/supplier/ddt/templates/page.tsx`.
- `app/(supplier)/supplier/ddt/templates/[id]/page.tsx`.
- `app/(supplier)/supplier/ddt/templates/template-editor-client.tsx`.
- `app/(supplier)/supplier/dashboard/page.tsx` — **ridisegnata** (file esiste già, verrà riscritta; in "Modified").
- `components/supplier/delivery/delivery-day-view.tsx` — raggruppata per slot/zona.
- `components/supplier/delivery/delivery-card.tsx` — card indirizzo + link Maps + colli/peso.
- `components/supplier/delivery/delivery-calendar.tsx` — vista settimanale/mensile.
- `components/supplier/delivery/delivery-detail-mobile.tsx` — timeline stato + bottoni grandi.
- `components/supplier/delivery/signature-canvas.tsx` — canvas fullscreen con undo/clear/save.
- `components/supplier/delivery/pod-photo-capture.tsx` — input camera (`capture="environment"`).
- `components/supplier/delivery/zone-editor.tsx` — form zona (province, CAP, giorni, slot, warehouse).
- `components/supplier/delivery/slot-editor.tsx` — tabella slot `[{from,to,label,capacity}]`.
- `components/supplier/ddt/ddt-book.tsx` — tabella + ricerca full-text + filtro anno.
- `components/supplier/ddt/ddt-preview.tsx` — iframe signed URL + azioni.
- `components/supplier/ddt/ddt-template-editor.tsx` — logo upload, color picker, textarea header/footer/conditions con preview live.
- `components/supplier/ddt/ddt-pdf-document.tsx` — componente `@react-pdf/renderer` (JSX `<Document>/<Page>`).
- `components/supplier/dashboard/kpi-tiles.tsx` — 4 tile (revenue, ordini, clienti nuovi, ticket medio) con sparkline.
- `components/supplier/dashboard/alerts-banner.tsx` — lista alert in alto.
- `components/supplier/dashboard/revenue-chart-30d.tsx` — area chart recharts.
- `components/supplier/dashboard/top-customers-card.tsx`.
- `components/supplier/dashboard/top-products-card.tsx`.
- `components/supplier/dashboard/recent-deliveries-card.tsx`.

### Modified
- `app/(supplier)/supplier/dashboard/page.tsx` — riscritta sopra nuovi KPI.
- `app/(supplier)/layout.tsx` o sidebar component — aggiungere voci `Consegne`, `DDT`, `Zone` wrappate in `<RoleGate>` (già introdotto in 1C).
- `types/database.ts` — rigenerare dopo migration (script `npm run db:types`).
- `package.json` — `@react-pdf/renderer`, `recharts`, `signature_pad` (eventuale), `date-fns`.
- `next.config.*` — verificare che `@react-pdf/renderer` sia tra gli `experimental.serverComponentsExternalPackages` / `serverExternalPackages` (Next 15).
- Rimozione gate `phase1_enabled` nei layout/feature-flag utilities (default true ovunque).

---

## Task 1 — Dependencies & scaffolding

**Files:**
- Modify: `package.json`, `next.config.*`

- [ ] **Step 1: Install dependencies**

  ```bash
  npm install @react-pdf/renderer recharts signature_pad date-fns
  ```

  Nota: `date-fns` potrebbe già essere installato da fasi precedenti — in quel caso `npm ls date-fns` conferma e il comando non duplica.

- [ ] **Step 2: Configure server external packages**

  In `next.config.ts` (o `.mjs`) aggiungere `@react-pdf/renderer` a `serverExternalPackages` (Next 15). React-PDF non è bundle-friendly e deve girare lato server.

- [ ] **Step 3: Verify build**

  `npm run build` deve completare senza regressioni.

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json next.config.*
  git commit -m "chore(supplier): add react-pdf, recharts, signature_pad for fase 1D"
  ```

---

## Task 2 — Migration: mv_supplier_kpi_daily + storage policies

**Files:**
- Create: `supabase/migrations/20260501000001_phase1d_kpi_and_storage.sql`

**Spec refs:** §3.4 (mv_supplier_kpi_daily, mv_stock_at_risk), §7.4 (storage policies), §9 (perf dashboard).

- [ ] **Step 1: Write migration**

  Contenuto:

  ```sql
  -- mv_supplier_kpi_daily: KPI pre-aggregati per dashboard fornitore
  CREATE MATERIALIZED VIEW mv_supplier_kpi_daily AS
  SELECT
    os.supplier_id,
    (o.created_at AT TIME ZONE 'Europe/Rome')::date AS day,
    SUM(os.total_amount)                            AS revenue,
    COUNT(DISTINCT os.id)                           AS orders_count,
    COUNT(DISTINCT o.restaurant_id) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM order_splits os2
        JOIN orders o2 ON o2.id = os2.order_id
        WHERE os2.supplier_id = os.supplier_id
          AND o2.restaurant_id = o.restaurant_id
          AND o2.created_at < o.created_at
      )
    )                                               AS new_customers,
    AVG(os.total_amount)                            AS avg_ticket
  FROM order_splits os
  JOIN orders o ON o.id = os.order_id
  WHERE os.status IN ('confirmed','preparing','packed','shipped','delivered')
  GROUP BY os.supplier_id, day;

  CREATE UNIQUE INDEX mv_supplier_kpi_daily_pk
    ON mv_supplier_kpi_daily(supplier_id, day);

  -- mv_stock_at_risk: lotti in scadenza ≤ 30gg per alert
  CREATE MATERIALIZED VIEW mv_stock_at_risk AS
  SELECT
    p.supplier_id,
    sl.product_id,
    sl.warehouse_id,
    sl.id AS lot_id,
    (sl.expiry_date - CURRENT_DATE) AS days_to_expiry,
    sl.quantity_base
  FROM stock_lots sl
  JOIN products p ON p.id = sl.product_id
  WHERE sl.expiry_date IS NOT NULL
    AND sl.quantity_base > 0
    AND sl.expiry_date <= CURRENT_DATE + INTERVAL '30 days';

  CREATE INDEX mv_stock_at_risk_supplier_idx
    ON mv_stock_at_risk(supplier_id, days_to_expiry);

  -- Refresh function (used by trigger + cron)
  CREATE OR REPLACE FUNCTION refresh_supplier_kpi()
  RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_kpi_daily;
    REFRESH MATERIALIZED VIEW mv_stock_at_risk;
  END; $$;

  -- Cron: refresh ogni 15 min (pg_cron deve essere abilitata)
  SELECT cron.schedule(
    'refresh_supplier_kpi_15m',
    '*/15 * * * *',
    $$ SELECT refresh_supplier_kpi(); $$
  );

  -- Storage: ddt-pdfs (privato, signed URL)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('ddt-pdfs', 'ddt-pdfs', false)
  ON CONFLICT (id) DO NOTHING;

  CREATE POLICY "ddt_pdfs_read_supplier_or_restaurant"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'ddt-pdfs'
      AND (
        EXISTS (
          SELECT 1 FROM ddt_documents d
          WHERE d.pdf_url LIKE '%' || storage.objects.name
            AND is_supplier_member(d.supplier_id)
        )
        OR EXISTS (
          SELECT 1 FROM ddt_documents d
          JOIN deliveries dv ON dv.id = d.delivery_id
          JOIN order_splits os ON os.id = dv.order_split_id
          JOIN orders o ON o.id = os.order_id
          JOIN restaurants r ON r.id = o.restaurant_id
          WHERE d.pdf_url LIKE '%' || storage.objects.name
            AND r.profile_id = auth.uid()
        )
      )
    );

  CREATE POLICY "ddt_pdfs_write_supplier_ddt_generate"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'ddt-pdfs'
      -- supplier_id deriva dal path: ddt-pdfs/<supplier_id>/<year>/<uuid>.pdf
      AND has_supplier_permission(
        (string_to_array(storage.objects.name, '/'))[1]::uuid,
        'ddt.generate'
      )
    );

  -- Storage: delivery-proofs (firme + POD, privato)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('delivery-proofs', 'delivery-proofs', false)
  ON CONFLICT (id) DO NOTHING;

  CREATE POLICY "delivery_proofs_read_supplier"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'delivery-proofs'
      AND has_supplier_permission(
        (string_to_array(storage.objects.name, '/'))[1]::uuid,
        'delivery.execute'
      )
    );

  CREATE POLICY "delivery_proofs_write_driver_or_admin"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'delivery-proofs'
      AND has_supplier_permission(
        (string_to_array(storage.objects.name, '/'))[1]::uuid,
        'delivery.execute'
      )
    );

  -- Indice aggiuntivo per ricerca libro DDT
  CREATE INDEX IF NOT EXISTS idx_ddt_documents_supplier_year_number
    ON ddt_documents(supplier_id, year DESC, number DESC);
  ```

- [ ] **Step 2: Applica migration locale**

  `npx supabase db reset`. Se `pg_cron` non è disponibile in locale, fallback: wrap del `cron.schedule` in `DO $$ BEGIN … EXCEPTION WHEN undefined_function THEN NULL; END $$;` — registrare nella spec PR.

- [ ] **Step 3: Spot-check**

  Popolare manualmente un ordine di prova su supplier demo e lanciare `SELECT * FROM mv_supplier_kpi_daily WHERE supplier_id='<uuid>';`. Verifica revenue > 0 e `day` corretto.

- [ ] **Step 4: Regenera tipi TS**

  `npm run db:types` (o equivalente) → `types/database.ts`.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/20260501000001_phase1d_kpi_and_storage.sql types/database.ts
  git commit -m "feat(db): add mv_supplier_kpi_daily, mv_stock_at_risk and storage policies for fase 1D"
  ```

---

## Task 3 — Zone consegna: editor calendario + slot

**Files:**
- Create: `lib/supplier/delivery-zones/{schemas,actions}.ts`
- Create: `app/(supplier)/supplier/impostazioni/zone/{page,zones-client}.tsx`
- Create: `components/supplier/delivery/{zone-editor,slot-editor}.tsx`

**Spec refs:** §3.2 (`delivery_zones` estesa: `delivery_days int[]`, `cutoff_time time`, `delivery_slots jsonb`, `warehouse_id`), §5.3 step 1 (slot usati in consegne).

- [ ] **Step 1: Schemas + server actions**

  `lib/supplier/delivery-zones/schemas.ts`:
  - `DeliverySlotSchema = z.object({ from: z.string().regex(HH_MM), to: z.string().regex(HH_MM), label: z.string().max(40), capacity: z.number().int().min(1).max(999) })`
  - `DeliveryZoneSchema = z.object({ id: z.string().uuid().optional(), name, provinces: z.array(z.string().length(2)), zip_codes: z.array(z.string().regex(/^\d{5}$/)).optional(), delivery_days: z.array(z.number().int().min(0).max(6)).min(1), cutoff_time: z.string().regex(HH_MM), delivery_slots: z.array(DeliverySlotSchema).min(1), warehouse_id: z.string().uuid() })`

  `actions.ts`: `createZone`, `updateZone`, `deleteZone`. Permesso: `settings.manage`.

- [ ] **Step 2: Editor UI**

  `zone-editor.tsx`: card con form (nome, multi-select province, tags CAP, checkbox giorni Lun-Dom, time input cutoff, `<WarehouseSwitcher>` bound al form).
  `slot-editor.tsx`: tabella righe slot (from, to, label, capacity) con add/remove.
  Dark tokens, stringhe italiane ("Nuova zona", "Giorni consegna", "Orario cutoff", "Slot orari", "Capacità massima").

- [ ] **Step 3: Page wrapper**

  `zone/page.tsx` (server): load `delivery_zones` + `warehouses` per il supplier corrente, renderizza `<ZonesClient initialZones={…} warehouses={…} />`.

- [ ] **Step 4: Verifica manuale**

  - Crea zona "Milano Nord", province `MI`, CAP `20100-20199`, giorni Lu+Me+Ve, cutoff 10:00, 2 slot (08-12 cap 10, 14-18 cap 10), warehouse primario.
  - Ricarica: riappare identica.
  - RLS: come utente di altro supplier, zona non visibile.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/supplier/delivery-zones app/\(supplier\)/supplier/impostazioni/zone components/supplier/delivery/zone-editor.tsx components/supplier/delivery/slot-editor.tsx
  git commit -m "feat(supplier): zone editor with calendar, slots and warehouse binding"
  ```

---

## Task 4 — Vista consegne del giorno

**Files:**
- Create: `lib/supplier/deliveries/{schemas,actions}.ts`
- Create: `app/(supplier)/supplier/consegne/{page,deliveries-day-client}.tsx`
- Create: `components/supplier/delivery/{delivery-day-view,delivery-card}.tsx`

**Spec refs:** §5.3 step 1 (driver day view filtrato), §6.3 (HoReCa UX), §4.3 (RoleGate driver).

- [ ] **Step 1: Query server**

  In `consegne/page.tsx`:
  - `const today = today(Europe/Rome)`; carica `deliveries` con `scheduled_date = today` e `order_split.supplier_id = currentSupplier`.
  - Join: `deliveries → order_splits → orders → restaurants` (address, city, province, zip_code, phone), `delivery_zones`.
  - Se membro ha `role='driver'` e non ha `delivery.plan`: filtro `driver_member_id = me.id`.
  - Risultato raggruppato per `scheduled_slot.label` → poi per `delivery_zone.name`.

- [ ] **Step 2: `delivery-day-view` + `delivery-card`**

  Card mostra: nome ristorante + indirizzo, bottone "Apri in Maps" (`https://www.google.com/maps/search/?api=1&query=<encoded>`), chip slot, contatori colli/peso (da `deliveries.colli/peso_kg` se già popolati, altrimenti N/D), note, bottone "Dettaglio".
  Mobile-first: 1 colonna < 640px, 2 ≥ lg.

- [ ] **Step 3: Filtri client**

  `deliveries-day-client.tsx`: filtro per driver (se il membro è admin e ci sono più driver), toggle "solo non completate".

- [ ] **Step 4: Verifica manuale**

  Seed 3 delivery oggi (slot 08-12 e 14-18, zone diverse). Login come driver A → vede solo le sue. Login come admin → vede tutte, ragguppate per slot.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/supplier/deliveries app/\(supplier\)/supplier/consegne/page.tsx app/\(supplier\)/supplier/consegne/deliveries-day-client.tsx components/supplier/delivery/delivery-day-view.tsx components/supplier/delivery/delivery-card.tsx
  git commit -m "feat(supplier): consegne day view grouped by slot with driver filter"
  ```

---

## Task 5 — Vista calendario consegne (settimana/mese)

**Files:**
- Create: `app/(supplier)/supplier/consegne/calendario/{page,calendar-client}.tsx`
- Create: `components/supplier/delivery/delivery-calendar.tsx`

**Spec refs:** §5.3 step 1 (slot usati/capienza), §9 (perf con aggregazioni).

- [ ] **Step 1: Query aggregata**

  Action `getDeliveryCalendar({from, to})` → array `{ date, zone_id, slot_label, used, capacity }` calcolata:
  `COUNT(deliveries)` per slot in range, joined con `delivery_zones.delivery_slots->capacity`.

- [ ] **Step 2: Componente `delivery-calendar`**

  Toggle settimana/mese. Celle giorno mostrano: barra per slot (`used/capacity`, colore rosso se ≥ 100%, ambra ≥ 80%, verde < 80%). Click cella → filtra `/supplier/consegne?date=YYYY-MM-DD`.

- [ ] **Step 3: Verifica manuale**

  Con 5 slot saturi e 3 quasi: colori corretti; navigazione settimana avanti/indietro funzionante.

- [ ] **Step 4: Commit**

  ```bash
  git add app/\(supplier\)/supplier/consegne/calendario components/supplier/delivery/delivery-calendar.tsx
  git commit -m "feat(supplier): delivery calendar with slot capacity heatmap"
  ```

---

## Task 6 — Dettaglio consegna mobile-first: firma + POD

**Files:**
- Create: `app/(supplier)/supplier/consegne/[id]/{page,delivery-detail-client}.tsx`
- Create: `components/supplier/delivery/{delivery-detail-mobile,signature-canvas,pod-photo-capture}.tsx`
- Modify: `lib/supplier/deliveries/actions.ts`

**Spec refs:** §5.3 step 3-5 (firma canvas → PNG bucket `delivery-proofs`, POD opzionale, fallita con motivo obbligatorio), §6.3.6 (mobile-first), §7.3 (RLS delivery `driver` su proprie).

- [ ] **Step 1: Server actions stato**

  - `startDelivery(id)` → `loaded → in_transit`, registra evento `shipped`.
  - `markDelivered(id, {signatureBlob, podBlob?, colli, peso_kg})` → upload file in `delivery-proofs/<supplier_id>/<delivery_id>.{sig,pod}.png`, aggiorna `deliveries.recipient_signature_url`, `pod_photo_url`, `delivered_at`, `status='delivered'`. Trigger evento `delivered` e notifica cliente+admin.
  - `markFailed(id, {reason})` → status `failed`, `failure_reason`, notifica admin con canale email+push (spec §8.2).
  - Tutte con permesso `delivery.execute`; `driver` solo sulle proprie (controllo applicativo + RLS).

- [ ] **Step 2: `signature-canvas`**

  Componente client fullscreen (sheet mobile): canvas `<canvas>` con touch + mouse handlers (o `signature_pad`), bottoni "Pulisci", "Annulla", "Conferma". Export `toBlob('image/png')` con DPR scaling.

- [ ] **Step 3: `pod-photo-capture`**

  `<input type="file" accept="image/*" capture="environment">` con preview.

- [ ] **Step 4: `delivery-detail-mobile`**

  Timeline stato in alto (planned → loaded → in_transit → delivered/failed), indirizzo + Maps, lista righe `delivery_items` con prodotto/lotto/scadenza (fix HoReCa §6.3.8 colori scadenza). Bottoni grandi: "Inizia giro", "In transito", "Consegnato", "Fallita". Modal firma; modal fallita con textarea motivo.

- [ ] **Step 5: Verifica manuale**

  - Flusso completo: loaded → in_transit → disegna firma → delivered. Verifica `recipient_signature_url` popolato e bucket policy (driver altro supplier: 403).
  - Flusso fallita: motivo obbligatorio, status `failed`, notifica admin ricevuta.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/supplier/deliveries/actions.ts app/\(supplier\)/supplier/consegne/\[id\] components/supplier/delivery/delivery-detail-mobile.tsx components/supplier/delivery/signature-canvas.tsx components/supplier/delivery/pod-photo-capture.tsx
  git commit -m "feat(supplier): delivery detail with signature canvas and POD capture"
  ```

---

## Task 7 — DDT numbering + generatore PDF React-PDF

**Files:**
- Create: `lib/supplier/ddt/{numbering,render}.ts`
- Create: `components/supplier/ddt/ddt-pdf-document.tsx`

**Spec refs:** §3.1 (`ddt_documents`), §5.3 step 2 (template, lotti per riga, upload `ddt-pdfs`), §7.6 (`pg_advisory_xact_lock(hashtext('ddt:'||supplier_id||':'||year))`).

- [ ] **Step 1: `numbering.ts`**

  ```ts
  export async function nextDdtNumber(supplierId: string, year: number, tx: SupabaseClient) {
    // dentro RPC SQL: SELECT pg_advisory_xact_lock(hashtext('ddt:'||$1||':'||$2));
    //                SELECT COALESCE(MAX(number),0)+1 FROM ddt_documents WHERE supplier_id=$1 AND year=$2;
  }
  ```

  Implementare via RPC SQL `public.next_ddt_number(p_supplier_id uuid, p_year int)` e chiamarla dentro la transazione della server action.

- [ ] **Step 2: `ddt-pdf-document.tsx`**

  Componente `@react-pdf/renderer`:
  - Header: logo (da `ddt_templates.logo_url`), ragione sociale supplier, P.IVA, CF, REA.
  - Titolo: "DOCUMENTO DI TRASPORTO N. {number}/{year}" con causale.
  - Blocco mittente/destinatario da `recipient_snapshot`.
  - Tabella righe: prodotto, u.m., quantità, lotto, scadenza. (Lotti+scadenze per riga da `delivery_items → stock_lots`.)
  - Footer: vettore, colli, peso, conditions_text, spazio firme.
  - `primary_color` applicato a linee/intestazioni colonna.
  - Modalità `copia=true` → filigrana diagonale "COPIA" (opacità 0.15).

- [ ] **Step 3: `render.ts`**

  ```ts
  import { renderToBuffer } from '@react-pdf/renderer';
  export async function renderDdtPdf(data: DdtRenderInput): Promise<Buffer> {
    return renderToBuffer(<DdtPdfDocument {...data} />);
  }
  ```

  Only-server: import top-level `import "server-only"`.

- [ ] **Step 4: Verifica manuale**

  Script temporaneo `scripts/ddt-preview.ts`: renderizza un DDT di test su file locale e apre. Controlla layout, font (Helvetica fallback), filigrana COPIA.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/supplier/ddt/numbering.ts lib/supplier/ddt/render.ts components/supplier/ddt/ddt-pdf-document.tsx
  git commit -m "feat(supplier): DDT PDF renderer with React-PDF and advisory-locked numbering"
  ```

---

## Task 8 — Server action `generateDdtForDelivery` + ristampa COPIA

**Files:**
- Create: `lib/supplier/ddt/{schemas,actions}.ts`

**Spec refs:** §5.3 step 2 (trigger da consegna `loaded`), §7.5 (pattern action), §7.6 (lock).

- [ ] **Step 1: `generateDdtForDelivery(deliveryId)`**

  - `getUser()` + permesso `ddt.generate`.
  - Transazione: `SELECT next_ddt_number(...)`, costruisce `recipient_snapshot` JSON dallo stato corrente, chiama `renderDdtPdf`, uploada in `ddt-pdfs/<supplier_id>/<year>/<uuid>.pdf`, insert `ddt_documents` con `pdf_url`, ritorna `signedUrl`.
  - Auto-trigger al passaggio `loaded`: hook nella action `markLoaded` (già in 1C) che invoca `generateDdtForDelivery` se non esiste DDT collegato.

- [ ] **Step 2: `getDdtSignedUrl(id)`**

  Signed URL 5 minuti da bucket `ddt-pdfs`. Rispetta RLS lettura.

- [ ] **Step 3: `reprintDdtCopy(id)`**

  Ri-renderizza PDF con `copia=true`, upload a path `<original>-copy-<ts>.pdf`, ritorna signed URL. Non modifica `ddt_documents` originale (immutabile).

- [ ] **Step 4: Verifica manuale**

  Crea delivery `loaded` → DDT generato automatico, number = 1 → secondo DDT → number = 2. Concorrenza: lanciare due generate in parallelo su diversi delivery → numeri diversi, niente duplicati. Ristampa COPIA: PDF ha filigrana.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/supplier/ddt/schemas.ts lib/supplier/ddt/actions.ts
  git commit -m "feat(supplier): generate DDT on delivery loaded with progressive numbering and COPIA reprint"
  ```

---

## Task 9 — Libro DDT: lista + dettaglio

**Files:**
- Create: `app/(supplier)/supplier/ddt/{page,ddt-book-client}.tsx`
- Create: `app/(supplier)/supplier/ddt/[id]/page.tsx`
- Create: `components/supplier/ddt/{ddt-book,ddt-preview}.tsx`

**Spec refs:** §4.1 routing `ddt/`, §7.3 RLS lettura.

- [ ] **Step 1: Libro DDT**

  Server page carica ultimi 100 DDT del supplier con paginazione server-side (per anno). Tabella colonne: numero, data, cliente (da `recipient_snapshot.name`), causale, totale stimato, azioni (Anteprima, Scarica, Ristampa COPIA).
  `ddt-book-client.tsx`: ricerca testo (numero o cliente o `ilike`) + dropdown anno + filtro causale.

- [ ] **Step 2: Dettaglio DDT**

  `[id]/page.tsx`: `<DdtPreview ddt={…} signedUrl={…} />` con `<iframe src={signedUrl}>` + azioni (Download, Ristampa COPIA, link alla consegna).

- [ ] **Step 3: Verifica manuale**

  - Popolare 30 DDT su 2 anni. Verifica ricerca "MARIO ROSSI" filtra; dropdown 2025/2026 separati.
  - Apri PDF → caricamento OK. Ristampa COPIA → file nuovo con filigrana.
  - Login come ristorante destinatario: `/supplier/ddt/[id]` è 404 (non supplier) ma signed URL condiviso può essere aperto (policy storage §7.4).

- [ ] **Step 4: Commit**

  ```bash
  git add app/\(supplier\)/supplier/ddt/page.tsx app/\(supplier\)/supplier/ddt/ddt-book-client.tsx app/\(supplier\)/supplier/ddt/\[id\] components/supplier/ddt/ddt-book.tsx components/supplier/ddt/ddt-preview.tsx
  git commit -m "feat(supplier): DDT book with search, year filter and reprint"
  ```

---

## Task 10 — Editor template DDT

**Files:**
- Create: `app/(supplier)/supplier/ddt/templates/{page,[id]/page,template-editor-client}.tsx`
- Create: `components/supplier/ddt/ddt-template-editor.tsx`
- Modify: `lib/supplier/ddt/actions.ts` (add template CRUD)

**Spec refs:** §3.1 (`ddt_templates`), §5.3 step 2 (logo + primary_color + header/footer HTML + conditions_text).

- [ ] **Step 1: Azioni template**

  `createTemplate`, `updateTemplate`, `deleteTemplate`, `setDefaultTemplate`. Permesso `ddt.manage_templates`. Upload logo in `ddt-assets` (o riusare `product-images` con prefix `ddt/`; preferire bucket nuovo già creato in Task 2 se introdotto — altrimenti usare `product-images`).

- [ ] **Step 2: Editor UI**

  `ddt-template-editor.tsx`:
  - Logo upload (drag & drop, max 500KB, PNG/JPG).
  - `<input type="color">` primary_color (default `#0EA5E9`).
  - Textarea header_html, footer_html, conditions_text — sanitizzate (DOMPurify lato client per preview; server controlla sempre prima di render PDF).
  - Preview live a destra: renderizza `<DdtPdfDocument>` in React-PDF web viewer (`PDFViewer`), oppure fallback statico con screenshot placeholder se l'embedding non funziona in Next 15.

- [ ] **Step 3: Lista template**

  `/supplier/ddt/templates`: grid card template con anteprima logo + chip "Predefinito", azioni Modifica/Imposta predefinito/Elimina.

- [ ] **Step 4: Verifica manuale**

  - Crea template "Salumeria Rossi", logo caricato, primary `#B91C1C`, footer "Merce viaggia per conto e rischio del destinatario".
  - Impostalo predefinito.
  - Genera DDT su nuova consegna → PDF usa il nuovo template (logo + colore).

- [ ] **Step 5: Commit**

  ```bash
  git add app/\(supplier\)/supplier/ddt/templates components/supplier/ddt/ddt-template-editor.tsx lib/supplier/ddt/actions.ts
  git commit -m "feat(supplier): DDT template editor with logo, primary color and HTML blocks"
  ```

---

## Task 11 — KPI queries + dashboard tiles & alerts

**Files:**
- Create: `lib/supplier/kpi/queries.ts`
- Create: `components/supplier/dashboard/{kpi-tiles,alerts-banner}.tsx`
- Modify: `app/(supplier)/supplier/dashboard/page.tsx`

**Spec refs:** §3.4 (`mv_supplier_kpi_daily`, `mv_stock_at_risk`), §8 (alert eventi), §9 (perf).

- [ ] **Step 1: `lib/supplier/kpi/queries.ts`**

  - `getKpiTiles(supplierId)`: legge ultimi 14 giorni da `mv_supplier_kpi_daily`; calcola revenue totale, ordini, clienti nuovi, ticket medio, delta vs 14gg precedenti.
  - `getAlerts(supplierId)`:
    - ordini pending > 24h: `SELECT count(*) FROM order_splits WHERE supplier_id=$1 AND status='pending' AND created_at < now() - interval '24 hours'`.
    - lotti in scadenza ≤ 7gg: `COUNT(*) FROM mv_stock_at_risk WHERE supplier_id=$1 AND days_to_expiry <= 7`.
    - consegne fallite ultima settimana: `COUNT(*) FROM deliveries ... WHERE status='failed' AND delivered_at > now() - interval '7 days'` (attraverso `order_splits`).

- [ ] **Step 2: `kpi-tiles.tsx`**

  4 tile in griglia 2x2 / 4x1 (responsive) con sparkline 14gg (recharts `<LineChart>` minimal). Delta colorato verde/rosso.

- [ ] **Step 3: `alerts-banner.tsx`**

  Banner in alto dashboard: fino a 3 alert, icona lucide (`AlertTriangle`, `Clock`, `PackageX`), colore ambra/rosso. Click → naviga alla sezione (`/supplier/ordini?status=pending`, `/supplier/magazzino/lotti?expiring=7`, `/supplier/consegne?failed=7d`).

- [ ] **Step 4: Dashboard ridisegnata (base)**

  `dashboard/page.tsx`: server component carica tutti i dati, renderizza `<AlertsBanner />`, `<KpiTiles />` in cima.

- [ ] **Step 5: Verifica manuale**

  - Forza stato: 2 ordini pending creati 30h fa, 1 lotto in scadenza fra 3gg, 1 delivery `failed` ieri → banner mostra 3 alert con link corretti.
  - KPI: revenue coerente con `SELECT SUM(revenue)` diretto su view.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/supplier/kpi/queries.ts components/supplier/dashboard/kpi-tiles.tsx components/supplier/dashboard/alerts-banner.tsx app/\(supplier\)/supplier/dashboard/page.tsx
  git commit -m "feat(supplier): dashboard KPI tiles and alert banner from mv_supplier_kpi_daily"
  ```

---

## Task 12 — Dashboard: chart 30gg + top clienti/prodotti + recent deliveries

**Files:**
- Create: `components/supplier/dashboard/{revenue-chart-30d,top-customers-card,top-products-card,recent-deliveries-card}.tsx`
- Modify: `app/(supplier)/supplier/dashboard/page.tsx`
- Modify: `lib/supplier/kpi/queries.ts`

**Spec refs:** §3.4, §9.

- [ ] **Step 1: Queries aggiuntive**

  - `getRevenue30d(supplierId)`: 30 righe da `mv_supplier_kpi_daily` ordinate per giorno (pad dei giorni mancanti a 0).
  - `getTopCustomers(supplierId, month)`: top 5 ristoranti per revenue nel mese corrente, `JOIN restaurants`.
  - `getTopProducts(supplierId, month)`: top 5 prodotti per quantità/revenue da `order_split_items`.
  - `getRecentDeliveries(supplierId, limit=8)`: ultime consegne con status + ristorante + slot.

- [ ] **Step 2: Componenti**

  - `revenue-chart-30d.tsx`: recharts `<AreaChart>` gradient verde, tooltip con data + euro formattati.
  - `top-customers-card.tsx` / `top-products-card.tsx`: `DarkCard` con lista riga (avatar/iniziali, nome, metrica destra).
  - `recent-deliveries-card.tsx`: list item con chip status colore coerente, orario relativo.

- [ ] **Step 3: Layout dashboard**

  Griglia: riga 1 alert banner (full); riga 2 KPI tiles (full); riga 3 revenue chart (2/3) + recent deliveries (1/3); riga 4 top customers (1/2) + top products (1/2). Responsive: 1 colonna mobile.

- [ ] **Step 4: Verifica manuale**

  Con seed di dati realistici su 30 giorni: chart mostra trend, top-5 corretti, deliveries recenti ordinati.

- [ ] **Step 5: Commit**

  ```bash
  git add components/supplier/dashboard app/\(supplier\)/supplier/dashboard/page.tsx lib/supplier/kpi/queries.ts
  git commit -m "feat(supplier): dashboard revenue chart, top customers/products and recent deliveries"
  ```

---

## Task 13 — Sidebar/RoleGate + auto-generate DDT al loaded

**Files:**
- Modify: sidebar/layout del supplier area
- Modify: server action `markLoaded` da 1C (hook a `generateDdtForDelivery`)

**Spec refs:** §4.3 (sidebar role gate), §5.3 step 2 (DDT auto su `loaded`), §8 (notifiche).

- [ ] **Step 1: Voci sidebar**

  Aggiungere 3 voci wrappate in `<RoleGate>`:
  - `Consegne` (`/supplier/consegne`, `allowed: admin, sales, warehouse, driver`)
  - `DDT` (`/supplier/ddt`, `allowed: admin, warehouse, sales`)
  - Sotto `Impostazioni > Zone` (`allowed: admin`)

- [ ] **Step 2: Hook auto-DDT**

  Nella action `markLoaded(deliveryId)` già esistente (1C), dopo commit transizione stato chiamare `generateDdtForDelivery(deliveryId)` se `!existing ddt_documents.delivery_id`. Try/catch: se fallisce, log + notifica admin (canale in-app) ma non rollback stato.

- [ ] **Step 3: Verifica manuale**

  - Driver non vede voce Zone; warehouse non vede Staff (già da 1C).
  - Prepara split → click "Carica giro" → PDF DDT creato in background, visibile in `/supplier/ddt`.

- [ ] **Step 4: Commit**

  ```bash
  git add <paths>
  git commit -m "feat(supplier): sidebar gating for fase 1D + auto-generate DDT on delivery loaded"
  ```

---

## Task 14 — Rimozione feature flag `phase1_enabled` + docs

**Files:**
- Modify: ogni punto che controlla `suppliers.feature_flags.phase1_enabled`
- Modify: `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md` (nota "Rollout completato")

**Spec refs:** §11.2 (feature flag e rollout).

- [ ] **Step 1: Trova usages**

  Grep `phase1_enabled` in `lib/**`, `app/(supplier)/**`, `middleware.ts`. Lista tutti i call site.

- [ ] **Step 2: Default true ovunque**

  Strategia: lasciare la colonna `feature_flags` sul DB (per futuri flag), ma rimuovere ogni gate UI/server che ne dipende. Comportamento equivalente a "flag true per tutti".
  Opzionale: backfill `UPDATE suppliers SET feature_flags = feature_flags || jsonb_build_object('phase1_enabled', true)` come hygiene.

- [ ] **Step 3: Smoke test completo**

  Percorso end-to-end Fase 1:
  1. Cliente piazza ordine.
  2. Sales accetta per riga (1C).
  3. Warehouse prepara con FEFO (1B/1C).
  4. Driver apre `/supplier/consegne`, inizia giro, firma, consegna.
  5. DDT generato automatico visibile in `/supplier/ddt`.
  6. Dashboard aggiornata con nuova revenue + recent delivery.

- [ ] **Step 4: Commit finale Fase 1**

  ```bash
  git add <paths>
  git commit -m "feat(supplier): complete fase 1 — remove phase1_enabled gate, enable by default"
  ```

---

## Completion criteria

Fase 1 si considera completa quando:

1. Tutte le task 1D sono verificate manualmente senza regressioni.
2. L'end-to-end ordine → preparazione → consegna → DDT → dashboard funziona sia su desktop sia su mobile (firma canvas validata su touch).
3. `mv_supplier_kpi_daily` si refresha via cron ogni 15 min (query `SELECT * FROM cron.job` mostra l'entry).
4. Nessun supplier è gated da `phase1_enabled`.
5. Storage bucket policies verificate da test cross-supplier (403 atteso).
6. Dashboard carica ≤ 300ms per un supplier con 10k ordini (il MV è l'ottimizzazione chiave).
