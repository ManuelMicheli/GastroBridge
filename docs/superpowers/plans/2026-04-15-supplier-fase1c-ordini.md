# Admin Fornitore Fase 1C — Workflow ordini professionale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** portare l'area ordini del fornitore da "lista semplice + stato globale" a workflow professionale per riga: ricezione automatica con split righe `pending`, accettazione per-riga con rettifica/rifiuto motivato, conferma cliente per modifiche, prenotazione stock FEFO su `confirmed`, picking list magazziniere, timeline eventi, notifiche email + web push.

**Dipendenze:** 1A merged (schema `order_split_items` / `order_split_events` / `supplier_members` / `role_permissions` / `notification_preferences` / `push_subscriptions` + RLS helper RPC), 1B merged (tabelle `stock_lots` + `stock_movements`, allocator FEFO in `lib/supplier/inventory/fefo.ts`).

**Architettura:** submit ordine lato ristorante esegue una server action esplicita `lib/orders/submit.ts` che crea `order_splits` + popola `order_split_items` status `pending` in unica transazione (niente trigger Postgres — logica visibile). Le azioni fornitore vivono in `lib/orders/supplier-actions.ts` e operano per split con pre-check `has_supplier_permission(split.supplier_id, 'order.accept_line'|'order.prepare')` + RLS come gate finale. La prenotazione stock invoca l'allocator FEFO di 1B; in caso di scarsità emette evento `stock_conflict` invece di prenotare parzialmente. Notifiche smistate da `lib/notifications/dispatcher.ts` che legge `notification_preferences` e delega a `email` (Resend) + `push` (`web-push` npm con VAPID) + in-app (insert su `notifications` 1A). `RealtimeRefresh` esistente esteso a `order_splits` e `order_split_items`.

**Tech stack:** Next.js 15 App Router · Supabase SSR + Realtime · TypeScript strict · Tailwind v4 (dark-dashboard tokens) · Zod v4 · `@dnd-kit/core` (kanban) · `web-push` (server) · `resend` (email) · `sonner` (toast) · `lucide-react`.

**Reference spec:** `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md` — §5.1 (ricezione+accettazione), §5.2 (preparazione FEFO), §7 (sicurezza/lock), §8 (matrice notifiche).

**Testing model:** niente framework unit; ogni task termina con **verification steps** eseguite manualmente (browser + SQL console Supabase). Fanno eccezione FEFO + numeric edge (già coperti in 1B) e concorrenza stock qui testata via script SQL ad-hoc in Task 6.

**Convenzioni (da codice esistente):**
- Server actions in `lib/<domain>/*.ts` con `"use server"`, ritorno `{ ok: true; data } | { ok: false; error: string }`.
- Supabase browser client: `createClient()` da `@/lib/supabase/client`. Server: da `@/lib/supabase/server`.
- Tutte le stringhe UI in italiano.
- Dark-dashboard tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `accent-green`, `accent-amber`, `accent-red`) già in `app/globals.css`.
- Icon set `lucide-react` v1.6.0.
- `useRealtimeRefresh` da `lib/hooks/useRealtimeRefresh.ts` (già presente).
- Permission check applicativo SEMPRE prima della mutation, anche se RLS duplica — serve per errori parlanti.

---

## File Structure

### Created
- `lib/orders/submit.ts` — server action `submitOrder` (split creation + items pending) invocata dal checkout ristorante
- `lib/orders/supplier-actions.ts` — `acceptOrderLines` (bulk), `respondCustomerConfirmation`, `pickItem`, `markPacked`, `reserveStockForSplit` (interna)
- `lib/orders/stock-reservation.ts` — helper `reserveSplit()` / `unreserveSplit()` che scrive `stock_movements` type `order_reserve|order_unreserve` usando FEFO allocator 1B
- `lib/orders/events.ts` — helper `emitSplitEvent(splitId, type, meta)` wrapper su `order_split_events`
- `lib/notifications/dispatcher.ts` — `dispatchEvent(eventType, supplierId, payload)` legge `notification_preferences` e smista
- `lib/notifications/email.ts` — template HTML + `sendEmail` via Resend
- `lib/notifications/push.ts` — `sendPush(subscription, payload)` via `web-push`
- `lib/notifications/templates/*.tsx` — template React per ogni evento (`order_received`, `order_accepted`, `order_shipped`, `customer_confirmation_request`)
- `app/api/push/send/route.ts` — route handler server-only protetta da service-role key
- `app/api/push/subscribe/route.ts` — upsert di una `push_subscriptions` per l'utente corrente
- `public/sw.js` — Service Worker con handler `push` e `notificationclick`
- `lib/push/client.ts` — `registerPushSubscription()` + `unregisterPushSubscription()` lato browser
- `app/(supplier)/supplier/ordini/orders-client.tsx` — client lista con filtri + toggle vista
- `app/(supplier)/supplier/ordini/kanban/page.tsx` — server component kanban
- `app/(supplier)/supplier/ordini/kanban/kanban-client.tsx` — drag&drop stati
- `app/(supplier)/supplier/ordini/[id]/order-detail-client.tsx` — accettazione per-riga + shortcut tastiera
- `app/(supplier)/supplier/ordini/[id]/preparazione/page.tsx` — picking list server component
- `app/(supplier)/supplier/ordini/[id]/preparazione/picking-client.tsx` — conferma picking FEFO
- `app/(app)/ordini/[id]/conferma/page.tsx` — pagina ristorante per approvare/rifiutare modifiche fornitore
- `app/(app)/ordini/[id]/conferma/customer-confirm-client.tsx`
- `components/supplier/orders/order-line-row.tsx` — riga con A/M/R + input quantità
- `components/supplier/orders/order-status-badge.tsx`
- `components/supplier/orders/order-timeline.tsx` — legge `order_split_events`
- `components/supplier/orders/kanban-column.tsx`
- `components/supplier/orders/kanban-card.tsx`
- `components/supplier/orders/picking-list-row.tsx`
- `components/supplier/orders/stock-conflict-banner.tsx`
- `components/supplier/notifications/push-subscription-manager.tsx` — bottone abilita/disabilita push in topbar
- `supabase/migrations/20260418000001_order_submit_trigger_guard.sql` — NOT NULL + CHECK extra su `order_split_items`, index per query frequenti, nessun trigger
- `docs/env/NOTIFICATIONS.md` — istruzioni VAPID + Resend setup (SOLO se richiesto in review; altrimenti skip)

### Modified
- `app/(supplier)/supplier/ordini/page.tsx` — server component rielaborato che legge split + items + counts per stato
- `app/(supplier)/supplier/ordini/[id]/page.tsx` — server component; carica split + items + eventi + lotti proposti
- `lib/orders/actions.ts` — marcato deprecato a favore di `submit.ts` e `supplier-actions.ts`; conservare import chiamanti esistenti
- `app/(app)/cerca/ordine/cart-client.tsx` + `app/(app)/cataloghi/.../*` che attualmente creano ordini → rindirizzare a `submitOrder`
- `lib/hooks/useRealtimeRefresh.ts` — nessuna modifica richiesta, si usa come è (già generico)
- `components/supplier/shared/sidebar.tsx` (o equivalente) — aggiungere link `Kanban` sotto Ordini
- `package.json` — aggiungere `@dnd-kit/core`, `@dnd-kit/sortable`, `web-push`, `@types/web-push`, `resend`
- `.env.example` — aggiungere `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`

---

## Task 1 — Dipendenze e env

**Files:** `package.json`, `.env.example`, `lib/env.ts` (se presente)

- [ ] **Step 1 — Installare dipendenze**

```bash
npm install @dnd-kit/core @dnd-kit/sortable web-push resend
npm install -D @types/web-push
```

- [ ] **Step 2 — Generare chiavi VAPID (una tantum per ambiente)**

```bash
npx web-push generate-vapid-keys
```

Inserire in `.env.local` e `.env.example` come placeholder:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ops@gastrobridge.it
RESEND_API_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # stesso valore della public per il client SW
```

- [ ] **Step 3 — Verify build**

`npm run build` deve compilare senza errori nuovi.

- [ ] **Step 4 — Commit**

```
chore(deps): add dnd-kit, web-push, resend for order workflow + notifications
```

---

## Task 2 — Submit ordine esplicito (lato ristorante)

Riferimento: spec §5.1 punto 1.

**Files:** `lib/orders/submit.ts`, integrazione in `app/(app)/cerca/ordine/cart-client.tsx` e in `app/(app)/cataloghi/*` dove l'ordine oggi viene persistito via `lib/orders/actions.ts`.

- [ ] **Step 1 — Scrivere `lib/orders/submit.ts`**

Export `submitOrder(input: SubmitOrderInput)`. Logica:
1. `getUser()` → altrimenti errore.
2. Zod parse input: `{ restaurantId, items: [{ productId, supplierId, quantity, salesUnitId?, unitPrice, notes? }], deliveryDate?, deliveryLocationId? }`.
3. Verifica che `restaurant.profile_id === user.id` via RLS-safe select.
4. Raggruppa items per `supplierId` → per ciascun gruppo un `order_split`.
5. Transazione single-statement via RPC `create_order_with_splits(p_payload jsonb)` (scriverla come SQL in migration Task 3) che:
   - crea `orders` row (header),
   - crea `order_items` per ogni riga,
   - crea `order_splits` (status `pending`, `warehouse_id` = primary del supplier),
   - crea `order_split_items` (status `pending`, `quantity_requested`, `unit_price`, `sales_unit_id`),
   - inserisce evento `received` in `order_split_events` per ciascuno split,
   - ritorna `{ order_id, split_ids[] }`.
6. Per ogni split_id ritornato, chiama `dispatchEvent('order_received', supplierId, { splitId })` (fire-and-forget, non bloccare success).
7. Return `{ ok: true, data: { orderId, splitIds } }`.

- [ ] **Step 2 — Cablare checkout ristorante**

Sostituire le chiamate attuali nel flow di checkout (cart-client, confronta/compare-client per ordine ottimale, cataloghi checkout) a `submitOrder`. Rimuovere logica duplicata in `lib/orders/actions.ts` ma mantenere il file come re-export deprecato.

- [ ] **Step 3 — Verification**

- Dal ristorante eseguire un ordine multi-fornitore (2 supplier, 3 righe).
- In Supabase Studio verificare: 1 riga `orders`, 2 righe `order_splits` status `pending`, 3 righe `order_split_items` con `status='pending'` e `quantity_requested` coerenti, 2 eventi `received` in `order_split_events`.

- [ ] **Step 4 — Commit**

```
feat(orders): explicit submitOrder server action populating order_split_items
```

---

## Task 3 — Migration supporto ordini + indici

**Files:** `supabase/migrations/20260418000001_order_submit_trigger_guard.sql`

- [ ] **Step 1 — Scrivere migration**

Contenuto:
- Funzione SQL `create_order_with_splits(p_payload jsonb) returns jsonb` (usata in Task 2) con `SECURITY INVOKER` — RLS applica; tutti gli insert rispettano le policy del ristorante.
- CHECK su `order_split_items.status` coerente con enum `order_line_status`.
- CHECK `quantity_accepted >= 0` e `quantity_accepted <= quantity_requested * 2` (upper sanity).
- Indici: `idx_osi_split_id (order_split_id)`, `idx_osi_status (status)`, `idx_order_splits_supplier_status (supplier_id, status)`, `idx_ose_split_created (order_split_id, created_at desc)`.
- GRANT / policy verificate (delta rispetto 1A se mancavano).

- [ ] **Step 2 — Applica localmente**

```bash
npx supabase db push
```

Verifica in Studio che la funzione `create_order_with_splits` esista e gli indici siano presenti.

- [ ] **Step 3 — Commit**

```
feat(db): RPC create_order_with_splits + indici order workflow
```

---

## Task 4 — Eventi, permessi helper e notifiche scaffold

Riferimento: spec §7.5 (pattern server actions), §8 (canali + matrice).

**Files:** `lib/orders/events.ts`, `lib/notifications/dispatcher.ts`, `lib/notifications/email.ts`, `lib/notifications/push.ts`, `lib/notifications/templates/*.tsx`

- [ ] **Step 1 — `lib/orders/events.ts`**

Export `emitSplitEvent(supabase, { splitId, eventType, memberId?, note?, metadata? })` → insert su `order_split_events`. Idempotenza non richiesta (audit log).

- [ ] **Step 2 — `lib/notifications/dispatcher.ts`**

Export `dispatchEvent(eventType: NotificationEvent, supplierId: string, payload: Record<string,unknown>)`:
1. Query `supplier_members` attivi del supplier.
2. Per ognuno, query `notification_preferences` per l'eventType → lista canali abilitati (default da matrice §8.2 se riga assente).
3. In parallelo: `sendEmail` / `sendPush` / insert `notifications` in-app.
4. Errori loggati via console.error, non throw (non vogliamo rompere la transazione business).

- [ ] **Step 3 — `lib/notifications/email.ts`** — wrapper Resend con `from='ordini@gastrobridge.it'`. Render template React con `renderToStaticMarkup`.

- [ ] **Step 4 — `lib/notifications/push.ts`** — wrapper `web-push` con VAPID da env. Esegue `webpush.sendNotification(subscription, JSON.stringify(payload))`; su errore 410/404 cancella la subscription da `push_subscriptions`.

- [ ] **Step 5 — Template**

`templates/order-received.tsx` (destinatario: membri supplier), `order-accepted.tsx` (ristorante), `order-shipped.tsx` (ristorante), `customer-confirmation-request.tsx` (ristorante, con link magic `/ordini/[id]/conferma?token=...`). Link token = HMAC firmato con `AUTH_SECRET` contenente `{splitId, exp}` valido 48h; verificato server-side alla pagina.

- [ ] **Step 6 — Verification**

Invocare `dispatchEvent('order_received', <supplierId>, { splitId })` da un endpoint debug temporaneo (`app/api/debug/dispatch/route.ts` — RIMUOVERE al termine task). Verificare arrivo email a membro admin e che il record sia presente in tabella `notifications`.

- [ ] **Step 7 — Commit**

```
feat(notifications): dispatcher multi-channel (email+push+in-app) with event templates
```

---

## Task 5 — Service Worker + subscription push (client)

Riferimento: spec §8.1 punto 3.

**Files:** `public/sw.js`, `lib/push/client.ts`, `app/api/push/subscribe/route.ts`, `components/supplier/notifications/push-subscription-manager.tsx`

- [ ] **Step 1 — `public/sw.js`**

Handler `push`: `event.waitUntil(self.registration.showNotification(payload.title, { body, icon, badge, data: { url } }))`. Handler `notificationclick`: apre `data.url`.

- [ ] **Step 2 — `lib/push/client.ts`**

`registerPushSubscription()`: registra SW (`/sw.js`), chiama `subscribe({ userVisibleOnly: true, applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY })`, POST a `/api/push/subscribe`.

- [ ] **Step 3 — `app/api/push/subscribe/route.ts`**

Upsert su `push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)`.

- [ ] **Step 4 — `PushSubscriptionManager`**

Bottone in topbar area supplier: mostra stato (disabilitato / abilitato), toggle che invoca register/unregister. Salva `last_used_at` al refresh.

- [ ] **Step 5 — Verification**

Da Chrome DevTools → Application → Service Workers → verificare registrazione. Dalla console: `Notification.requestPermission()` granted. Riga in `push_subscriptions` presente. Triggerare un test push da endpoint debug di Task 4: notifica arriva al browser.

- [ ] **Step 6 — Commit**

```
feat(push): web-push subscription + service worker
```

---

## Task 6 — Prenotazione stock FEFO + gestione conflitti

Riferimento: spec §5.1 punto 5 (prenotazione), §7.6 (`SELECT ... FOR UPDATE`).

**Files:** `lib/orders/stock-reservation.ts`

- [ ] **Step 1 — `reserveSplit(supabase, splitId)`**

Dentro una transazione RPC Postgres `reserve_split(p_split_id uuid) returns jsonb`:
1. `FOR UPDATE` su tutte le `order_split_items` dello split.
2. Per ogni riga accepted/modified, chiama funzione 1B `fefo_allocate(product_id, warehouse_id, qty)` → ritorna lista `{ lot_id, qty_base }`.
3. Se somma allocata < qty richiesta → **NON prenota**, raccoglie conflitto.
4. Se tutte ok → per ogni allocazione, `UPDATE stock_lots SET quantity_reserved_base = quantity_reserved_base + qty` (CHECK vincolo naturale). Insert `stock_movements (movement_type='order_reserve', ref_order_split_id=split, lot_id, quantity_base=-qty)`. (Nota: type reserve può usare quantità positiva con semantica "riservato"; definire convenzione in commento).
5. Ritorna `{ ok: true }` o `{ ok: false, conflicts: [{ productId, requested, available }] }`.

- [ ] **Step 2 — `unreserveSplit(splitId)`**

Reverse: decrementa `quantity_reserved_base`, insert `stock_movements` type `order_unreserve`. Usato al rifiuto cliente post-modifica.

- [ ] **Step 3 — Test concorrenza**

Script SQL in `scripts/test-stock-concurrency.sql` (local only): due session che chiamano `reserve_split` sullo stesso prodotto con stock esiguo. Verifica che solo una riesca e l'altra ritorni conflict.

- [ ] **Step 4 — Commit**

```
feat(orders): FEFO-backed stock reservation with conflict detection
```

---

## Task 7 — Server actions fornitore: accettazione righe

Riferimento: spec §5.1 punti 3-4-6.

**Files:** `lib/orders/supplier-actions.ts`

- [ ] **Step 1 — `acceptOrderLines({ splitId, lines: [{ lineId, action: 'accept'|'modify'|'reject', quantityAccepted?, rejectionReason? }] })`**

1. Auth + permission `has_supplier_permission(supplier_id, 'order.accept_line')` via RPC.
2. Version check: `updated_at` dello split confrontato con quello inviato dal client.
3. Per ogni riga applica UPDATE status + `quantity_accepted` + `rejection_reason`.
4. Determina esito globale:
   - tutte `accepted` → split `confirmed` → `reserveSplit(splitId)`.
     - se reserve OK → evento `accepted`, `dispatchEvent('order_accepted', supplierId)`.
     - se conflict → UPDATE split status `stock_conflict`, evento `stock_conflict` con metadata conflicts; dispatch in-app+push a sales/admin.
   - almeno una `modified|rejected` → status `pending_customer_confirmation`, evento `partially_accepted`, dispatch email al ristorante con token link.
   - tutte `rejected` → status `rejected`, evento `rejected`, dispatch cliente.
5. Return `{ ok: true, data: { splitStatus, conflicts? } }`.

- [ ] **Step 2 — `respondCustomerConfirmation({ splitId, token, decision: 'approve'|'reject' })`**

Usata dalla pagina ristorante `/ordini/[id]/conferma`.
- Verifica token HMAC.
- Auth ristorante (user.id === restaurant.profile_id dello split).
- `approve` → split `confirmed` → `reserveSplit`; se conflict stessa gestione di Step 1.
- `reject` → split `canceled` (niente prenotazione), evento `canceled`.
- Dispatch notifiche al supplier.

- [ ] **Step 3 — Verification**

Scenario 1: ordine 3 righe tutte accepted → split `confirmed`, stock_lots.quantity_reserved_base aggiornato, email al ristorante.

Scenario 2: 1 modify (quantità ridotta) → split `pending_customer_confirmation`, email al ristorante; ristorante clicca link e approva → `confirmed` + reserve.

Scenario 3: stock insufficiente → split `stock_conflict`, nessun movimento registrato, commerciale vede banner.

- [ ] **Step 4 — Commit**

```
feat(orders): supplier acceptOrderLines + customer confirmation flow
```

---

## Task 8 — UI lista ordini con filtri e toggle kanban

Riferimento: spec §4.1.

**Files:** `app/(supplier)/supplier/ordini/page.tsx` (riscritto), `app/(supplier)/supplier/ordini/orders-client.tsx`, `components/supplier/orders/order-status-badge.tsx`

- [ ] **Step 1 — Server page**

Carica split del supplier corrente (con join restaurant, counts righe per stato, expected_delivery_date). Query paginata 50/page. Ordinamento default `created_at desc`. Passa dati a `orders-client`.

- [ ] **Step 2 — `orders-client.tsx`**

- Filtri: stato (multi-select), periodo (preset 7/30/90gg), ristorante (search), warehouse (se multi).
- Toggle vista: Tabella ↔ Kanban (link a `/supplier/ordini/kanban`).
- Tabella con colonne: # / Cliente / Ricevuto / Atteso consegna / Totale / Stato (badge colorato) / Azioni (Apri dettaglio).
- `useRealtimeRefresh([{ table: 'order_splits', filter: 'supplier_id=eq.<id>' }, { table: 'order_split_items' }])`.

- [ ] **Step 3 — Verification**

Crea 3 ordini in stati diversi, verifica filtri + refresh realtime (modifica stato da SQL → la lista si aggiorna).

- [ ] **Step 4 — Commit**

```
feat(supplier): redesigned orders list with status filters and realtime
```

---

## Task 9 — Vista kanban drag&drop

Riferimento: spec §4.1 (route `/ordini/kanban`), §5.1 (stati pending→confirmed→preparing→packed).

**Files:** `app/(supplier)/supplier/ordini/kanban/page.tsx`, `kanban-client.tsx`, `components/supplier/orders/kanban-column.tsx`, `kanban-card.tsx`

- [ ] **Step 1 — Server**

Fetch split raggruppati per stato `pending`, `pending_customer_confirmation`, `confirmed`, `preparing`, `packed`, `stock_conflict`.

- [ ] **Step 2 — Client con `@dnd-kit/core`**

- Colonne orizzontali scrollabili.
- Card con: # ordine, cliente, n° righe, totale, giorni-a-consegna.
- Drag tra colonne permesso SOLO per transizioni legali: `confirmed → preparing`, `preparing → packed`. Le altre transizioni richiedono dettaglio (accettazione per riga) → blocca drop con toast informativo.
- Drop su colonna valida → optimistic UI + server action `transitionSplitStatus({ splitId, targetStatus })` (aggiungere a `supplier-actions.ts`; permission `order.prepare`).

- [ ] **Step 3 — Verification**

Trascinare una card da `confirmed` a `preparing` → status aggiornato in DB, evento `preparing` emesso. Drag illegale → toast "Transizione non consentita — apri il dettaglio ordine".

- [ ] **Step 4 — Commit**

```
feat(supplier): kanban view with legal-only drag transitions
```

---

## Task 10 — Dettaglio ordine con accettazione per-riga + timeline

Riferimento: spec §5.1 punto 3, §6.3 (shortcut A/M/R).

**Files:** `app/(supplier)/supplier/ordini/[id]/page.tsx` (rielaborato), `order-detail-client.tsx`, `components/supplier/orders/order-line-row.tsx`, `order-timeline.tsx`, `stock-conflict-banner.tsx`

- [ ] **Step 1 — Server**

Fetch split + items + restaurant + events + (se status `stock_conflict`) conflitti da metadata ultimo evento.

- [ ] **Step 2 — Client**

- Header: cliente, data consegna prevista, totale, badge stato.
- Se `stock_conflict` → `<StockConflictBanner>` con lista righe problematiche + CTA "Rettifica le righe interessate".
- Lista righe: `<OrderLineRow>` per riga con: nome prodotto, qty richiesta (readonly), qty accettata (input editable), sales_unit badge, prezzo, combo `A` (accept) / `M` (modify, focus su input qty) / `R` (reject, apri modal motivo obbligatorio).
- Shortcut tastiera: focus su riga (tab) → tasti `A` / `M` / `R` agiscono sulla riga focalizzata. Usare hook custom `useKeyboardShortcuts`.
- Bulk action: "Accetta tutto" in header.
- Bottone "Invia risposta al cliente" → chiama `acceptOrderLines`. Loading + toast esito.
- `<OrderTimeline>` verticale con eventi `order_split_events` ordinati desc, icon + timestamp relativo + membro autore.
- `useRealtimeRefresh` per `order_splits`, `order_split_items`, `order_split_events` filtrati su split_id.

- [ ] **Step 3 — Verification**

- Apri ordine, premi Tab finché una riga ha focus, premi `R` → modal rifiuto apre con focus sul textarea motivo.
- Modifica qty di una riga + accetta le altre → submit → split `pending_customer_confirmation`, email al ristorante.
- La timeline mostra `received` → `partially_accepted`.

- [ ] **Step 4 — Commit**

```
feat(supplier): order detail with per-line acceptance + keyboard shortcuts + timeline
```

---

## Task 11 — Pagina conferma cliente (ristorante)

Riferimento: spec §5.1 punto 4.

**Files:** `app/(app)/ordini/[id]/conferma/page.tsx`, `customer-confirm-client.tsx`

- [ ] **Step 1 — Server**

- Legge `?token=...` da query, verifica HMAC, estrae `splitId + exp`.
- Scaduto → 410 con pagina "Link scaduto, contatta il fornitore".
- Fetch split + items (quantity_requested vs quantity_accepted) + supplier.

- [ ] **Step 2 — Client**

- Riepilogo con diff: righe "Accettate", "Modificate" (qty richiesta → qty proposta, evidenziato), "Rifiutate" (con motivo).
- Totale ricalcolato vs totale originale.
- CTA "Approva modifiche" / "Rifiuta e annulla ordine".
- Submit chiama `respondCustomerConfirmation`.
- Post-submit mostra pagina conferma con stato finale (confirmed / canceled / stock_conflict).

- [ ] **Step 3 — Verification**

Flusso end-to-end: supplier modifica → ristorante apre link da email → approva → split `confirmed` + stock riservato.

- [ ] **Step 4 — Commit**

```
feat(orders): customer-side confirmation page for supplier modifications
```

---

## Task 12 — Picking list magazziniere con FEFO

Riferimento: spec §5.2.

**Files:** `app/(supplier)/supplier/ordini/[id]/preparazione/page.tsx`, `picking-client.tsx`, `components/supplier/orders/picking-list-row.tsx`, action `pickItem` + `markPacked` in `lib/orders/supplier-actions.ts`

- [ ] **Step 1 — Server page**

- Verifica split status ∈ {`confirmed`, `preparing`} e permission `order.prepare`.
- Alla prima apertura, se status `confirmed` → transition a `preparing`, emit evento `preparing`.
- Per ogni `order_split_item` con `status in (accepted, modified)`: chiama FEFO allocator (read-only, sulle quote disponibili = `quantity_base - quantity_reserved_base + già_riservate_per_split`) per suggerire lotto principale + alternative.

- [ ] **Step 2 — `picking-client.tsx`**

- Layout print-friendly (CSS `@media print`).
- Righe: prodotto, qty da prelevare, **lotto proposto** (code + scadenza color-coded), dropdown alternative, checkbox "Prelevato".
- Click "Prelevato" → chiama `pickItem({ splitItemId, lotId, quantityBase })`.
- Quando tutte le righe sono `picked` → bottone "Completa e imballa" abilitato → `markPacked({ splitId })`.

- [ ] **Step 3 — `pickItem` server action**

Dentro RPC transazionale:
1. Permission `order.prepare`.
2. `SELECT ... FOR UPDATE` sul lotto.
3. Insert `delivery_items (delivery_id = ensure_delivery(split), order_split_item_id, lot_id, quantity_base, quantity_sales_unit)`.
4. Insert `stock_movements` type `order_ship` quantità negativa.
5. UPDATE `stock_lots`: `quantity_base -= qty`, `quantity_reserved_base -= qty_reserved_correspondente`.
6. UPDATE `order_split_items.status = 'picked'` (aggiungere al enum in migration Task 3 se manca: verificare — spec §3.3 ha solo pending|accepted|modified|rejected; picking è a livello split, quindi usiamo un flag locale in UI via conteggio `delivery_items` invece di modificare enum — **scelta: nessuna modifica enum, la UI considera riga "picked" quando esiste `delivery_item` associato**).

`ensure_delivery(split_id)`: crea `deliveries` status `planned` se non esiste per lo split, ritorna id.

- [ ] **Step 4 — `markPacked`**

Verifica tutte le righe hanno `delivery_items` con qty totale = qty_accepted. UPDATE split `status='packed'`, delivery `status='loaded'`, emit eventi `packed`. Dispatch notifica `order_shipped` al ristorante (con intento "pronto per consegna" — la spedizione vera è in 1D; riutilizziamo l'evento per ora oppure documentiamo che in 1C arriva in fase `packed`).

- [ ] **Step 5 — Verification**

Prodotto con 3 lotti (scadenze 30/60/90gg) → picking propone lotto 30gg. Alternative mostrano gli altri due. Conferma picking → `stock_movements` order_ship con lot_id 30gg, `quantity_base` decrementato. Completa tutte le righe → bottone "Completa e imballa" → split `packed`.

- [ ] **Step 6 — Commit**

```
feat(supplier): FEFO picking list with lot proposal + alternatives
```

---

## Task 13 — Realtime, sidebar, permission gating finale

**Files:** componenti sidebar esistente, gating con `<RoleGate>` già in 1A.

- [ ] **Step 1 — Aggiungere link Kanban sotto Ordini**

Voce secondaria nella sidebar supplier con icona `LayoutKanban`.

- [ ] **Step 2 — RoleGate check**

Tutti i componenti di questo plan devono wrappare azioni pericolose: `acceptOrderLines` → visibile solo con `order.accept_line`; `pickItem` → `order.prepare`. Nascondere bottoni per ruoli non autorizzati (UX), oltre al gate server-side.

- [ ] **Step 3 — Verification matrice ruoli**

Login come ruolo `driver` → non vede azioni accettazione; come `warehouse` → vede picking ma non accettazione; come `sales` → vede accettazione ma non picking; come `admin` → vede tutto.

- [ ] **Step 4 — Commit**

```
feat(supplier): role-gated order workflow + kanban sidebar entry
```

---

## Task 14 — Feature flag + smoke test end-to-end + docs env

**Files:** `suppliers.feature_flags.phase1_enabled` (gating runtime), `.env.example`, eventuale `docs/env/NOTIFICATIONS.md` solo se l'utente lo richiede.

- [ ] **Step 1 — Gating**

In layout supplier leggere `suppliers.feature_flags.phase1_enabled`: se false e non siamo in dev → mostrare banner "Area in evoluzione" + link all'UI legacy preservata. Se true → UI 1C attiva.

- [ ] **Step 2 — Smoke test golden path**

1. Login supplier pilota con flag ON.
2. Login ristorante → ordine 2 fornitori 4 righe.
3. Supplier1: accetta tutto → stock riservato, notifica email al ristorante.
4. Supplier2: modifica 1 riga → ristorante riceve email → approva → stock riservato (o conflict).
5. Supplier1: apre picking list → preleva lotti → packed.
6. Verifica: in `order_split_events` tutti gli eventi; in `stock_movements` reserve + ship; notifiche arrivate (email + push + in-app); kanban riflette gli stati correnti in realtime.

- [ ] **Step 3 — Commit finale**

```
feat(supplier): phase 1C order workflow complete behind feature flag
```

---

## Out of scope (rimandato a 1D)

- Generazione DDT PDF + template editor.
- Vista consegne autista (`/supplier/consegne`) con firma e POD.
- `mv_supplier_kpi_daily` e dashboard KPI ridisegnata.
- Calendario consegne con slot.
- Route planning / zone avanzate.
- Reso post-consegna fallita (solo placeholder nell'evento `delivery_failed` via dispatcher).
- SMS notifiche (Fase 2).

---

## Rischi noti e mitigazioni

1. **Race condition prenotazione stock** → mitigata con `FOR UPDATE` su `stock_lots` in RPC (Task 6).
2. **Token conferma cliente intercettato** → HMAC con expiration 48h + single-use (aggiungere `consumed_at` a un mini table `customer_confirmation_tokens` se la review chiede hardening).
3. **web-push endpoint scaduto** → cleanup su errore 404/410 (Task 4 step 4).
4. **Kanban drag illegale** → validazione server-side in `transitionSplitStatus` (oltre all'UI).
5. **Drop delle email Resend** → fallback in-app garantito sempre; email log nel dashboard Resend.
