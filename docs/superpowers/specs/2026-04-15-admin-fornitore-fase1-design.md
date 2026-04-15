# Admin Fornitore — Fase 1: Operazioni Quotidiane

**Data:** 2026-04-15
**Stato:** Approvato (in attesa di review finale utente)
**Ambito:** Area `app/(supplier)/supplier/*` — riprogettazione professionale dell'area amministrativa fornitore Ho.Re.Ca.

## 1. Obiettivo

Fornire al fornitore Ho.Re.Ca. la prima metà di una piattaforma realmente vendibile come sostituto di un gestionale dedicato: flusso ordini operativo completo, catalogo con listini e unità multiple, magazzino con lotti/scadenze/tracciabilità, DDT conformi, multi-utente con ruoli, notifiche.

La piattaforma deve coprire dal piccolo fornitore locale (50 referenze, un magazzino) al medio strutturato (1500+ referenze, multi-magazzino, agenti), tramite data model scalabile e UI a *progressive disclosure*.

Questa è la **Fase 1** di una roadmap in 5 fasi; le altre (CRM+forza vendita, logistica avanzata, analytics/pricing, amministrazione/SDI) seguiranno con proprie spec.

## 2. Decisioni architetturali chiave

| # | Decisione | Scelta |
|---|---|---|
| 1 | Profilo cliente target | Data model enterprise, UI progressive disclosure (valido da piccolo a medio-grande) |
| 2 | Accettazione ordini | Per riga, con rettifica quantità + motivazione rifiuto |
| 3 | Listini | Entità listino + promo + sconti a scalare decisi dal fornitore |
| 4 | Stock/lotti | Giacenze numeriche + lotti con scadenza FEFO + tracciabilità completa in DDT |
| 5 | Unità prodotto | Sales_units multiple per prodotto con giacenza base condivisa |
| 6 | DDT | Conforme fiscalmente + template personalizzabile con logo |
| 7 | Consegne | Zone + calendario + slot orari + capacità |
| 8 | Staff | Multi-utente con 4 ruoli fissi (admin/sales/warehouse/driver) + RLS |
| 9 | Notifiche | In-app + email + push web (SMS rinviato a Fase 2) |

## 3. Data model

### 3.1 Nuove tabelle

#### `warehouses`
Magazzini/depositi del supplier.

Campi: `id uuid pk`, `supplier_id uuid fk suppliers`, `name text`, `address`, `city`, `province`, `zip_code`, `latitude numeric`, `longitude numeric`, `is_primary boolean`, `is_active boolean default true`, `created_at timestamptz`.

Vincolo: massimo 1 `is_primary=true` per supplier (unique partial index).

Backfill: per ogni supplier esistente crea 1 riga con `is_primary=true` e dati indirizzo copiati da `suppliers`.

#### `supplier_members`
Staff del fornitore — un profilo può essere membro di uno o più supplier con ruoli diversi (caso raro ma supportato).

Campi: `id uuid pk`, `supplier_id uuid fk`, `profile_id uuid fk profiles`, `role supplier_role`, `is_active boolean`, `invited_at timestamptz`, `accepted_at timestamptz nullable`, `invited_by uuid nullable`, `created_at`.

Unique: `(supplier_id, profile_id)`.

#### `role_permissions`
Tabella statica che mappa ruoli → permessi atomici. Seeded via migration, modificabile in Fase 2+ per ruoli custom.

Campi: `role supplier_role`, `permission text`, PRIMARY KEY `(role, permission)`.

Permessi atomici: `order.read`, `order.accept_line`, `order.prepare`, `pricing.read`, `pricing.edit`, `catalog.read`, `catalog.edit`, `stock.read`, `stock.receive`, `stock.adjust`, `ddt.generate`, `ddt.manage_templates`, `delivery.plan`, `delivery.execute`, `staff.manage`, `settings.manage`, `analytics.financial`, `reviews.reply`.

#### `product_sales_units`
Unità di vendita multiple per prodotto con conversione verso unità base.

Campi: `id uuid pk`, `product_id uuid fk products`, `label text` (es. "cartone 6pz"), `unit_type unit_type enum`, `conversion_to_base numeric` (quanto base per 1 sales_unit), `is_base boolean`, `barcode text nullable`, `moq numeric default 1`, `sort_order int default 0`, `is_active boolean default true`.

Trigger BEFORE INSERT/UPDATE/DELETE: garantisce esattamente 1 `is_base=true` per product.

Backfill: per ogni `products` crea 1 riga base con `conversion_to_base=1`, `label=products.unit`, `moq=products.min_quantity`.

#### `stock_lots`
Lotti di magazzino con scadenza per FEFO.

Campi: `id uuid pk`, `product_id`, `warehouse_id`, `lot_code text`, `expiry_date date nullable` (per prodotti non deperibili), `quantity_base numeric check ≥ 0`, `quantity_reserved_base numeric default 0 check ≥ 0`, `cost_per_base numeric nullable`, `received_at timestamptz`, `created_at`, `notes text`.

Indice principale: `(product_id, warehouse_id, expiry_date asc nulls last, received_at asc)` — driver del FEFO.
Check: `quantity_reserved_base ≤ quantity_base`.

#### `stock_movements`
Audit trail di tutti i movimenti.

Campi: `id uuid pk`, `product_id`, `lot_id uuid nullable`, `warehouse_id`, `quantity_base numeric` (positivo=carico, negativo=scarico), `movement_type stock_movement_type`, `ref_order_split_id uuid nullable`, `ref_delivery_item_id uuid nullable`, `created_by_member_id uuid fk supplier_members`, `created_at timestamptz`, `notes text`.

#### `price_lists`
Listini nominati del supplier.

Campi: `id`, `supplier_id`, `name`, `description text`, `is_default boolean`, `valid_from date nullable`, `valid_to date nullable`, `is_active boolean default true`, `created_at`, `updated_at`.

Vincolo: esattamente 1 `is_default=true` per supplier.

Backfill: per ogni supplier crea 1 listino `"Listino Base"` `is_default=true`.

#### `price_list_items`
Prezzo per combinazione listino × prodotto × sales_unit.

Campi: `id`, `price_list_id`, `product_id`, `sales_unit_id`, `price numeric check ≥ 0`, `created_at`, `updated_at`.

Unique: `(price_list_id, product_id, sales_unit_id)`.

Backfill: per ogni `products` inserisce riga su listino default con `price=products.price`, `sales_unit_id=riga base`.

#### `price_list_tier_discounts`
Sconti a scalare per volume.

Campi: `id`, `price_list_item_id`, `min_quantity numeric`, `discount_pct numeric check 0..100`, `sort_order int`.

Unique: `(price_list_item_id, min_quantity)`.

#### `promotions`
Promo a tempo.

Campi: `id`, `supplier_id`, `name`, `type promotion_type` (`percentage|fixed_amount|bundle`), `value numeric`, `starts_at timestamptz`, `ends_at timestamptz`, `applies_to text` (`all_catalog|categories|products|customers_segment`), `filter_ids uuid[]` (categorie, prodotti o restaurant_id a seconda di `applies_to`), `is_active`, `created_at`.

#### `customer_price_assignments`
Assegnazione listino a cliente (se assente → default).

Campi: `id`, `supplier_id`, `restaurant_id`, `price_list_id`, `created_at`.

Unique: `(supplier_id, restaurant_id)`.

#### `order_split_items`
Righe d'ordine lato fornitore con stato per-riga.

Campi: `id`, `order_split_id`, `order_item_id fk order_items`, `product_id`, `sales_unit_id`, `quantity_requested numeric`, `quantity_accepted numeric`, `unit_price numeric`, `status order_line_status`, `rejection_reason text nullable`, `notes text`, `updated_at`.

Popolata alla ricezione ordine, aggiornata durante accettazione.

#### `order_split_events`
Timeline eventi split per audit.

Campi: `id`, `order_split_id`, `event_type order_split_event_type`, `member_id uuid nullable`, `note text`, `metadata jsonb`, `created_at`.

#### `deliveries`
Consegne fisiche.

Campi: `id`, `order_split_id`, `warehouse_id`, `driver_member_id uuid nullable`, `scheduled_date date`, `scheduled_slot jsonb nullable`, `status delivery_status`, `delivered_at timestamptz nullable`, `recipient_signature_url text nullable`, `pod_photo_url text nullable`, `failure_reason text nullable`, `notes text`, `created_at`.

#### `delivery_items`
Righe consegnate legate al lotto (tracciabilità).

Campi: `id`, `delivery_id`, `order_split_item_id`, `lot_id`, `quantity_base numeric`, `quantity_sales_unit numeric` (ridondante per DDT), `created_at`.

#### `ddt_documents`
DDT generati, immutabili.

Campi: `id`, `supplier_id`, `delivery_id`, `number int`, `year int`, `causale ddt_causale`, `issued_at timestamptz`, `recipient_snapshot jsonb`, `vettore text`, `peso_kg numeric nullable`, `colli int nullable`, `pdf_url text`, `canceled_at timestamptz nullable`, `canceled_reason text nullable`, `template_id uuid fk ddt_templates`.

Unique: `(supplier_id, year, number)`.

#### `ddt_templates`
Template PDF personalizzabili.

Campi: `id`, `supplier_id`, `name`, `logo_url`, `primary_color text`, `header_html text nullable`, `footer_html text nullable`, `conditions_text text nullable`, `is_default boolean`, `created_at`.

Backfill: per ogni supplier crea 1 template default con logo da `suppliers.logo_url`.

#### `notification_preferences`
Opt-in canali per membro × evento.

Campi: `id`, `supplier_member_id`, `channel notification_channel`, `event_type notification_event`, `enabled boolean`, `updated_at`.

#### `push_subscriptions`
Web Push endpoints.

Campi: `id`, `profile_id`, `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `created_at`, `last_used_at`.

### 3.2 Modifiche a tabelle esistenti

- **`products`**: aggiungi `default_warehouse_id uuid nullable`, `hazard_class text nullable`, `tax_rate numeric default 10`. `price` e `unit` restano per back-compat (deprecate ma non droppate; calcolate come prezzo listino default × sales_unit base).
- **`order_splits`**: aggiungi `warehouse_id uuid`, `assigned_sales_member_id uuid nullable`, `expected_delivery_date date nullable`, `delivery_zone_id uuid nullable`.
- **`order_items`**: aggiungi `sales_unit_id uuid nullable` (quale unità ha scelto il cliente al checkout).
- **`suppliers`**: aggiungi `fiscal_code text nullable`, `rea_number text nullable`, `sdi_code text nullable` (uso futuro Fase 5), `default_ddt_template_id uuid nullable`, `feature_flags jsonb default '{}'::jsonb`.
- **`delivery_zones`**: aggiungi `delivery_days int[]` (0-6, domenica=0), `cutoff_time time`, `delivery_slots jsonb` (array di `{from, to, label, capacity}`), `warehouse_id uuid fk warehouses`.

### 3.3 Nuovi enum

- `supplier_role`: `admin | sales | warehouse | driver`
- `stock_movement_type`: `receive | order_reserve | order_unreserve | order_ship | adjust_in | adjust_out | return | transfer`
- `order_line_status`: `pending | accepted | modified | rejected`
- `order_split_event_type`: `received | accepted | partially_accepted | rejected | stock_conflict | preparing | packed | shipped | delivered | canceled`
- `delivery_status`: `planned | loaded | in_transit | delivered | failed`
- `ddt_causale`: `sale | consignment | return | transfer | sample | cancel`
- `promotion_type`: `percentage | fixed_amount | bundle`
- `notification_channel`: `email | push | sms`
- `notification_event`: `order_received | order_accepted | order_shipped | order_delivered | stock_low | lot_expiring | delivery_failed`

### 3.4 Viste materializzate

- `mv_supplier_kpi_daily(supplier_id, day, revenue, orders_count, new_customers, avg_ticket)` — refreshed ogni 15 min e on-demand dopo eventi critici.
- `mv_stock_at_risk(supplier_id, product_id, warehouse_id, lot_id, days_to_expiry, quantity_base)` per alert scadenze.

## 4. Architettura componenti e routing

### 4.1 Routing `app/(supplier)/supplier/`

```
supplier/
├── dashboard/page.tsx                    (aggiornato con KPI nuovi)
├── ordini/
│   ├── page.tsx                          (lista con toggle tabella/kanban)
│   ├── [id]/
│   │   ├── page.tsx                      (dettaglio + accettazione per riga)
│   │   └── preparazione/page.tsx         (picking list FEFO, vista warehouse)
│   └── kanban/page.tsx
├── catalogo/
│   ├── page.tsx                          (tabella prodotti)
│   ├── nuovo/page.tsx
│   ├── import/page.tsx                   (esteso per sales_units)
│   └── [id]/
│       ├── page.tsx                      (tab: generali, sales_units, listini, media)
│       └── prezzi/page.tsx
├── listini/
│   ├── page.tsx
│   ├── nuovo/page.tsx
│   └── [id]/page.tsx                     (editor griglia virtualizzata)
├── promo/
│   ├── page.tsx
│   └── [id]/page.tsx
├── magazzino/
│   ├── page.tsx                          (overview giacenze)
│   ├── lotti/page.tsx                    (FEFO + scadenze)
│   ├── carichi/
│   │   ├── page.tsx
│   │   └── nuovo/page.tsx
│   ├── inventario/page.tsx
│   └── movimenti/page.tsx
├── consegne/
│   ├── page.tsx                          (giri del giorno)
│   ├── calendario/page.tsx
│   └── [id]/page.tsx                     (dettaglio + firma + POD)
├── clienti/
│   ├── page.tsx
│   └── [id]/page.tsx                     (scheda: storico + listino + fido)
├── ddt/
│   ├── page.tsx                          (libro DDT + ricerca)
│   ├── [id]/page.tsx                     (anteprima + download)
│   └── templates/page.tsx
├── staff/
│   ├── page.tsx
│   └── nuovo/page.tsx                    (invita con ruolo)
├── analytics/page.tsx
├── recensioni/page.tsx
└── impostazioni/
    ├── page.tsx                          (profilo + fatturazione)
    ├── sedi/page.tsx                     (warehouses)
    ├── zone/page.tsx                     (delivery_zones con slot)
    ├── notifiche/page.tsx
    └── abbonamento/page.tsx
```

### 4.2 Organizzazione componenti

```
components/supplier/
├── orders/               (list, kanban, detail-client, line-item-row, timeline, picking-list)
├── catalog/              (product-table, product-form, sales-units-editor, price-matrix-row, import-wizard, media-uploader)
├── pricing/              (price-list-table, price-list-editor, tier-discount-editor, promotion-form, customer-assignment-modal)
├── inventory/            (stock-overview, lot-table, receive-form, adjustment-form, movement-log)
├── delivery/             (delivery-day-view, delivery-calendar, delivery-detail, route-planner)
├── ddt/                  (ddt-book, ddt-preview, ddt-pdf-renderer, ddt-template-editor)
├── staff/                (member-list, invite-form, role-picker)
├── notifications/        (notification-bell, notification-panel, push-subscription-manager)
└── shared/               (warehouse-switcher, role-gate, progressive-disclosure, empty-state)
```

### 4.3 Sidebar e visibility per ruolo

Menu raggruppato in 6 sezioni (Operativo / Commerciale / Magazzino / Documenti / Analisi / Configurazione). Ogni voce è wrappata in `<RoleGate allowed={[...]}>` che la nasconde se il membro corrente non ha il ruolo.

Progressive disclosure: calcolo `supplier.maturityLevel` (`basic|standard|advanced`) al login e nasconde voci/sezioni in base al livello (dettagli in §6.1).

### 4.4 Pattern data loading

- Server components per le page iniziali.
- Client components (`*-client.tsx`) per interazioni (accettazione, drag&drop kanban, editor listini).
- Server actions con Zod + permission check + audit log.
- Realtime via `RealtimeRefresh` esteso a `order_splits`, `order_split_items`, `stock_movements`, `deliveries`.

## 5. Workflow end-to-end

### 5.1 Ricezione e accettazione ordine

1. Cliente invia ordine → backend crea `order` + N `order_splits` + `order_split_items` (status `pending` per ogni riga).
2. Evento `received` in `order_split_events`. Notifica email + push a membri con ruolo `admin`/`sales`.
3. Commerciale apre `/supplier/ordini/[id]`, per ogni riga: conferma / rettifica quantità / rifiuta con motivo.
4. Invio risposta:
   - Tutte `accepted` → split `confirmed` immediatamente, prenotazione stock eseguita subito.
   - Almeno una `modified` o `rejected` → `pending_customer_confirmation`, email al cliente con riepilogo + link azione. Alla conferma cliente → `confirmed`, prenotazione stock eseguita. Al rifiuto cliente → split `canceled`.
   - Tutte `rejected` → split `rejected`, niente prenotazione.
5. **Prenotazione stock** (in ogni passaggio a `confirmed`): per ogni riga accepted/modified crea `stock_movements` type `order_reserve` e aggiorna `stock_lots.quantity_reserved_base`. Se stock insufficiente (race condition) → split `stock_conflict` + notifica commerciale con opzioni (rettifica/rifiuta le righe problematiche).
6. Eventi `accepted` o `partially_accepted` emessi. Notifiche a cliente + membri warehouse.

### 5.2 Preparazione magazziniere (FEFO)

1. Warehouse apre `/supplier/ordini/[id]/preparazione` → picking list ordinata per slot consegna + (futura) posizione magazzino.
2. Per ogni riga, sistema propone lotto con minor `expiry_date` e `quantity_base - quantity_reserved_base ≥` richiesta. Se nessun singolo lotto basta → split multi-lotto.
3. Magazziniere conferma "Prelevato": crea `delivery_items` con `lot_id`, scrive `stock_movements` type `order_ship` negativo, decrementa `quantity_base` e `quantity_reserved_base`.
4. Drop-down alternative se lotto proposto non disponibile fisicamente.
5. Fine split → `preparing → packed`, crea `deliveries` status `loaded`.

### 5.3 Consegna + DDT

1. Autista apre `/supplier/consegne` → vista del giorno filtrata su `driver_member_id = me`.
2. Per ciascuna delivery `loaded`, sistema genera DDT:
   - Advisory lock su `(supplier_id, year)` → nuovo numero progressivo.
   - Template da `default_ddt_template_id` o specifico.
   - Rendering PDF server-side (React-PDF preferito, Puppeteer fallback), upload bucket `ddt-pdfs`, salva `pdf_url`.
3. "Inizia giro" → `in_transit`. Al cliente: firma canvas → PNG in `delivery-proofs`; foto POD opzionale.
4. "Consegnato" → `delivered`, evento, notifica cliente + admin.
5. Consegna fallita → `failed` con motivo obbligatorio. Admin decide riprogrammazione (nuova delivery, stock già scaricato) o reso (stock rientro + ripristino lotti).

### 5.4 Carico magazzino

1. Warehouse su `/supplier/magazzino/carichi/nuovo`: barcode scan o select prodotto, compila warehouse, quantità (sales_unit), `lot_code`, `expiry_date`, `cost_per_base`.
2. Server action: valida, crea `stock_lots` + `stock_movements` type `receive`, calcola `quantity_base` da `conversion_to_base`.
3. Alert se `cost_per_base` devia oltre 15% da media precedente.

### 5.5 Gestione listini e promo

1. `/supplier/listini` → elenco listini (nome, validità, clienti assegnati, azioni).
2. Editor `/supplier/listini/[id]`: griglia virtualizzata TanStack Virtual, colonne prodotto/sales_unit/prezzo/scalari/margine%/azioni.
3. Bulk: aumento %, fisso, copia da altro listino.
4. Salvataggio per-cella debounced 600ms, optimistic UI.
5. Assegnazione cliente: dropdown in `/supplier/clienti/[id]` aggiorna `customer_price_assignments`.
6. Promo: form con tipo/validità/target. Al checkout cliente il sistema applica la promo migliore per riga (regola default: solo la migliore, configurabile in impostazioni supplier).

## 6. UX e progressive disclosure

### 6.1 Livello maturità

```
basic:    warehouses=1 AND staff=1 AND price_lists=1 AND customers_assigned=0
standard: (staff≥2 OR warehouses≥2 OR price_lists≥2) AND orders_last_30d<100
advanced: altrimenti
```

- `basic`: sidebar compatta (Dashboard, Ordini, Catalogo, Clienti, Magazzino, DDT, Impostazioni). Niente Listini/Staff/Zone avanzate.
- `standard`: sidebar completa inclusi Listini e Staff.
- `advanced`: warehouse-switcher globale, analytics avanzati, route planner attivo.

Override in impostazioni (`Base | Standard | Avanzato | Auto`).

### 6.2 Zero-state guidato

Tabelle vuote mostrano 3 CTA: "Crea il primo", "Importa CSV", "Copia template esempio" (es. "Distributore bevande", "Salumeria", "Ortofrutta").

### 6.3 Principi UX HoReCa

1. Prezzo mostrato per sales_unit **e** per unità base: `12,50 €/cartone (2,08 €/pezzo)`.
2. Densità alta di default; opzione vista comoda.
3. Shortcut tastiera: `g o/c/m` navigation; su accettazione `A/M/R`; `Cmd+K` esteso a query domain-specific.
4. Timestamp relativi con hover assoluto.
5. CSS print dedicato su preparazione e picking list.
6. Mobile-first su consegne (firma fullscreen, tap grandi).
7. Codici colore stato coerenti: verde=ok, ambra=attesa, rosso=problema, blu=info.
8. Scadenze a colpo d'occhio: rosso=scaduto, ambra≤7gg, giallo≤30gg, neutro altro.
9. Bulk action ovunque.

### 6.4 Onboarding

Wizard 5 step post-signup: dati azienda → magazzino primary → prima zona+calendario → logo+template DDT → primo prodotto (manuale/CSV/skip). Al termine `is_active=true`.

## 7. Sicurezza e permessi

### 7.1 Helper RPC SQL

- `is_supplier_member(p_supplier_id)` → bool
- `supplier_member_role(p_supplier_id)` → `supplier_role`
- `has_supplier_permission(p_supplier_id, p_permission)` → bool (consulta `role_permissions`)

### 7.2 Matrice ruoli → permessi

Seeded in `role_permissions` al migration time. Riepilogo in §4.3 del design. Esempi:

- `admin`: tutti i permessi.
- `sales`: `order.read/accept_line`, `catalog.*`, `pricing.*`, `delivery.plan`, `analytics.financial`, `reviews.reply`.
- `warehouse`: `order.read/prepare`, `stock.*`, `ddt.generate`, `delivery.execute`.
- `driver`: `order.read` (filtrato su consegne assegnate), `delivery.execute` (solo le proprie).

### 7.3 RLS policies

Ogni tabella ha policy basate su `is_supplier_member` + `has_supplier_permission`. Esempi rappresentativi:

- `order_splits` SELECT: supplier member + (sales/warehouse/admin) OR driver con delivery assegnata.
- `order_split_items` UPDATE: supplier con `order.accept_line`.
- `stock_lots` INSERT/UPDATE: supplier con `stock.receive` o `stock.adjust`.
- `price_list_items` ALL: supplier con `pricing.edit`.
- `ddt_documents` INSERT: supplier con `ddt.generate`. Nessun UPDATE/DELETE (DDT immutabili; cancellazione = nuovo record con `causale='cancel'`).
- `supplier_members` ALL: solo `role='admin'`.

### 7.4 Storage policies

- `product-images`: read public, write con `catalog.edit`.
- `ddt-pdfs`: read solo membri supplier owner OR ristorante destinatario.
- `delivery-proofs`: read solo admin/driver del supplier.

### 7.5 Server actions

Pattern standard:
1. `getUser()` altrimenti throw.
2. Zod strict parsing.
3. `has_supplier_permission` RPC come pre-check applicativo.
4. Mutation (RLS è l'ultimo gate).
5. Audit log.

### 7.6 Concorrenza e lock

- DDT numbering: `pg_advisory_xact_lock(hashtext('ddt:'||supplier_id||':'||year))`.
- Stock reserve/ship: `SELECT ... FOR UPDATE` su `stock_lots`.
- Accept order: version check su `order_splits.updated_at` per evitare doppia accettazione.

## 8. Notifiche

### 8.1 Canali

- **In-app**: bell icon in topbar, contatore non letti, panel con storico.
- **Email**: template HTML per ogni evento, invio via Resend/Postmark (già o da integrare).
- **Push web**: Service Worker + Web Push API, subscription salvata in `push_subscriptions`.

### 8.2 Matrice evento → destinatari di default

| Evento | admin | sales | warehouse | driver |
|---|---|---|---|---|
| `order_received` | in-app+email+push | in-app+email+push | — | — |
| `order_accepted` (ack cliente) | in-app | in-app | in-app+push | — |
| `order_shipped` | in-app | in-app | in-app | in-app+push (se assegnato) |
| `stock_low` | in-app+email | — | in-app+push | — |
| `lot_expiring` (≤7gg) | in-app+email | — | in-app+email | — |
| `delivery_failed` | in-app+email+push | in-app+email | — | — |

Tutti opt-out per canale in `notification_preferences` + pagina `/supplier/impostazioni/notifiche`.

## 9. Performance

- Editor listini: virtualizzazione (TanStack Virtual), debounced save, ricerca full-text locale.
- Catalogo: paginazione server-side, ricerca con `pg_trgm` su `name+brand+sku`.
- Dashboard: `mv_supplier_kpi_daily` pre-aggregato (refresh 15 min + on-demand).
- Realtime sottoscrizioni mirate per warehouse/ruolo.

## 10. Testing

### 10.1 Unit (target 90% su `lib/supplier/**`)

- FEFO allocator: date diverse, lotti frazionati, scarsità.
- Price resolver: listino default, customer override, sconti scalari, promo concorrenti.
- Stock conversion: sales_unit → base e viceversa con edge case numerici.
- DDT numbering: concorrenza simulata.

### 10.2 RLS test suite

Script che:
1. Crea 2 supplier, 4 membri per ruolo, 1 cross-supplier spia.
2. Esegue CRUD su ogni tabella per ogni ruolo.
3. Verifica accept/deny atteso.
4. Gira in CI prima di ogni deploy.

### 10.3 Integration

Server actions con Supabase test helper: ricezione → accettazione parziale → preparazione FEFO → consegna → DDT.

### 10.4 E2E (Playwright, solo golden path)

1. Signup supplier → onboarding → primo prodotto → ordine cliente → accettazione → picking → consegna → DDT scaricato.
2. Editor listino bulk su >200 prodotti.
3. FEFO: 3 lotti stesso prodotto, verifica picking list propone quello più vicino a scadenza.

## 11. Migrazione e rollout

### 11.1 Migrazione

Migration unica `20260417_phase1_foundations.sql` in transazione:
1. Crea enum + tabelle nuove.
2. Seed `role_permissions`.
3. Backfill: `warehouses` primary, `price_lists` default, `ddt_templates` default, `supplier_members` admin da `suppliers.profile_id`.
4. Backfill `product_sales_units` base da `products.unit` e `price_list_items` da `products.price`.
5. Backfill `customer_price_assignments` per restaurants con ordini storici al default.
6. Nessun dato perso, nessun comportamento utente-visibile cambiato se nessuno tocca ancora le nuove UI.

### 11.2 Feature flag

`suppliers.feature_flags.phase1_enabled` (default false in staging). Rollout: 1 supplier pilota → 5 → tutti. Vecchia UI e nuova coesistono 30 giorni.

### 11.3 Observability

- Pino logger su server actions con correlation id.
- Sentry client.
- `analytics_events` Supabase per eventi chiave (`order_accepted`, `ddt_generated`, `lot_received`) → telemetria di uso reale.

## 12. Deliverable

Una piattaforma supplier professionale che include:
- Dashboard KPI + alert.
- Workflow ordini per riga + preparazione FEFO + consegna firmata + DDT.
- Catalogo con sales_units, listini, promo, sconti scalari.
- Magazzino con lotti, scadenze, tracciabilità completa.
- DDT conformi + template personalizzabili.
- Multi-utente, 4 ruoli, RLS a 3 livelli.
- Notifiche email + push web.
- Multi-sede e multi-zona con slot.
- Progressive disclosure.

## 13. Piano implementativo (quattro plan sequenziali)

```
1A Fondamenta & Catalogo pro
   └─ migration unica, schema + RLS + helper RPC, catalogo con sales_units, listini base
1B Magazzino + lotti FEFO + tracciabilità
   └─ dipende da 1A (tabelle stock già create)
   └─ UI giacenze/lotti/carichi/inventario/movimenti, FEFO allocator, alert scadenze
1C Workflow ordini professionale
   └─ dipende da 1B (picking richiede lotti)
   └─ accettazione per riga, kanban, preparazione con FEFO, notifiche email+push, staff/ruoli
1D DDT + consegne + dashboard KPI
   └─ dipende da 1C (consegne partono da ordini preparati)
   └─ calendario consegne con slot, driver day view, firma+POD, generatore DDT PDF, mv_supplier_kpi_daily, dashboard ridisegnata
```

Ogni plan produce una release deployabile dietro feature flag; tutti e 4 uniti formano la Fase 1 completa.

## 14. Fuori scope Fase 1

Esplicito rimando a fasi successive:

- **Fase 2**: CRM 360° (fido/credito, ordine-tipo, riassortimento predittivo), segmentazione, agenti/provvigioni, SMS notifiche, sostituti automatici nell'accettazione.
- **Fase 3**: ottimizzazione rotte consegna, multi-deposito con transfer, integrazione GPS driver.
- **Fase 4**: analytics margine, Pareto, pricing intelligence, export.
- **Fase 5**: fatturazione elettronica SDI, scadenzario, incassi, solleciti, ruoli custom granulari.
