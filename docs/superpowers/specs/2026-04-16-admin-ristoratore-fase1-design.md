# Admin Ristoratore — Fase 1: Operazioni Quotidiane

**Data:** 2026-04-16
**Stato:** Approvato (in attesa di review finale utente)
**Ambito:** Area `app/(app)/*` — riprogettazione professionale dell'area amministrativa ristoratore Ho.Re.Ca. (equivalente a supplier Fase 1 per il lato buy-side)

## 1. Obiettivo

Trasformare l'area ristoratore da "catalogo + carrello consumer-like" in **procurement system professionale** che un head chef, F&B manager o titolare può adottare al posto di un gestionale dedicato (Plates, Foodcost, Worky, etc.).

La piattaforma deve:
- **Scalare** dal bar/trattoria singolo operatore (1 sede, 1 persona, 50 referenze) al ristorante medio (brigata 8 persone, 3 sedi, 400 referenze)
- **Rispettare** gli obblighi HACCP al ricevimento merce (reg. CE 852/2004 + Manuale di Corretta Prassi Igienica italiano)
- **Integrarsi** con il lavoro supplier Fase 1 già completato (accettazione ordini per riga, DDT, lotti, deliveries) e con il lavoro in flight su branch `feat/cataloghi-ristoratore` (partnership, messaggistica, listini personalizzati)

Questa è la **Fase 1** di una roadmap in 5 fasi; le altre (CRM fornitori + benchmark, amministrazione finanziaria + scadenzario, inventario + food cost + POS, compliance SDI) seguiranno con proprie spec.

## 2. Decisioni architetturali chiave

| # | Decisione | Scelta |
|---|---|---|
| 1 | Profilo target | Data model enterprise, UI progressive disclosure a 3 livelli (`basic/standard/advanced`) calcolati automaticamente |
| 2 | Team | 4 ruoli fissi (`owner/manager/chef/viewer`) + matrice permessi in `role_permissions_restaurant` |
| 3 | Approvazione ordini | Soglia budget configurabile dall'owner; sopra soglia → `pending_approval`. Default `NULL` = mai (piccolo ristoratore) |
| 4 | Order building | Bacheca "Da Ordinare" condivisa + ordine-tipo (template) + ordini ricorrenti programmati (pg_cron) |
| 5 | Par levels | Min/max/target per prodotto × sede; engine suggerimento con auto-push in bacheca; opt-in |
| 6 | Storico prezzo | Snapshot in `product_price_history` ad ogni invio ordine; mostrato inline al checkout e in analytics |
| 7 | Ricevimento | Per-riga (qty ricevuta/attesa + condition) + log temperatura merce deperibile + foto difetti + apertura automatica non-conformità |
| 8 | Non-conformità | Entità `order_issues` con workflow `open → acknowledged → in_progress → resolved/credited/closed`, collegata al thread messaggi esistente |
| 9 | Rating fornitore | Post-consegna: 3 stelle (puntualità, qualità, servizio) + commento. Alimenta `suppliers.rating_avg` via trigger |
| 10 | Multi-sede | Per-sede con `delivery_location_id` opzionale per riga (ordini cross-sede supportati). Partnership in `restaurant_suppliers` resta per-sede; UI di accettazione offre checkbox "Applica a tutte le sedi" che propaga l'accettazione agli altri `restaurants.id` dello stesso `profile_id` |
| 11 | Notifiche | In-app + email + push web, preferenze per membro × evento. Riuso `push_subscriptions` e canali del supplier Fase 1 |
| 12 | Feature flag | `restaurants.feature_flags.phase1_enabled` per rollout graduale con kill-switch |
| 13 | Partnership/messaggistica | Riuso di `restaurant_suppliers` e `partnership_messages` creati su `feat/cataloghi-ristoratore` — nessuna duplicazione |

## 3. Data model

### 3.1 Nuove tabelle

Tutte le tabelle sotto sono **aggiuntive** rispetto allo schema esistente.

#### `restaurant_members`
Team del ristorante. Un profilo può essere membro di più sedi/ristoranti con ruoli diversi.

Campi: `id uuid pk`, `restaurant_id uuid fk restaurants`, `profile_id uuid fk profiles`, `role restaurant_role`, `is_active boolean default true`, `invited_by uuid nullable`, `invited_at timestamptz`, `accepted_at timestamptz nullable`, `created_at`.

Unique: `(restaurant_id, profile_id)`.

Backfill: per ogni `restaurants` esistente crea 1 riga con `profile_id = restaurants.profile_id`, `role = 'owner'`, `accepted_at = now()`.

#### `role_permissions_restaurant`
Tabella statica role → permessi atomici. Seeded via migration, mutabile in Fase 2+ per ruoli custom.

Campi: `role restaurant_role`, `permission text`. PRIMARY KEY `(role, permission)`.

Permessi atomici: `order.draft`, `order.submit`, `order.approve`, `order.receive`, `catalog.read`, `partnership.manage`, `par_levels.manage`, `template.manage`, `recurring.manage`, `issue.open`, `issue.resolve`, `rating.submit`, `analytics.financial`, `staff.manage`, `settings.manage`, `subscription.manage`, `multi_sede.switch`.

Matrice seed:
- `owner`: tutti i permessi
- `manager`: tutti tranne `staff.manage`, `subscription.manage`, `order.approve` (può approvare solo sotto soglia personale — verifica su `created_by_member.role`)
- `chef`: `order.draft`, `order.submit` (rispettando soglia), `order.receive`, `catalog.read`, `par_levels.manage`, `template.manage`, `recurring.manage`, `issue.open`, `rating.submit`
- `viewer`: `catalog.read`, `analytics.financial` (read-only)

#### `to_order_items`
Bacheca "Da Ordinare" condivisa per sede.

Campi: `id uuid pk`, `restaurant_id uuid fk`, `product_id uuid nullable fk products`, `product_name_free text nullable`, `quantity numeric check > 0`, `sales_unit_hint text nullable`, `preferred_supplier_id uuid nullable fk suppliers`, `notes text nullable`, `added_by_member_id uuid fk restaurant_members`, `added_at timestamptz`, `status to_order_status default 'open'`, `consumed_in_order_id uuid nullable fk orders`, `source to_order_source default 'manual'`, `created_at`.

Check: `product_id IS NOT NULL OR product_name_free IS NOT NULL` (almeno uno dei due).

Status enum `to_order_status`: `open | in_draft | ordered | cancelled`.
Source enum `to_order_source`: `manual | par_level | template_run | recurring_run`.

#### `order_templates`
Ordini-tipo (template riutilizzabile).

Campi: `id uuid pk`, `restaurant_id uuid fk`, `name text`, `default_supplier_id uuid nullable fk suppliers`, `notes text nullable`, `is_shared_across_sedi boolean default false`, `created_by_member_id uuid fk`, `created_at`, `updated_at`.

Nota: se `is_shared_across_sedi = true` il template è visibile a tutte le sedi dello stesso `profiles.id` (via join).

#### `order_template_items`
Righe di un template.

Campi: `id uuid pk`, `template_id uuid fk order_templates`, `product_id uuid nullable fk products`, `product_name_free text nullable`, `quantity numeric check > 0`, `sales_unit_id uuid nullable`, `notes text nullable`, `sort_order int default 0`.

Check: `product_id IS NOT NULL OR product_name_free IS NOT NULL`.

#### `recurring_orders`
Schedulazione ordini ricorrenti.

Campi: `id uuid pk`, `restaurant_id uuid fk`, `template_id uuid fk order_templates`, `frequency recurring_frequency`, `day_of_week int nullable check 0-6`, `day_of_month int nullable check 1-31`, `time_of_day time`, `timezone text default 'Europe/Rome'`, `auto_send boolean default false`, `next_run_at timestamptz`, `last_run_at timestamptz nullable`, `is_active boolean default true`, `created_by_member_id uuid fk`, `created_at`, `updated_at`.

Frequency enum `recurring_frequency`: `daily | weekly | biweekly | monthly`.

Trigger `before insert/update`: ricalcola `next_run_at` in base a `frequency + day_of_week/month + time_of_day + timezone`.

#### `par_levels`
Livelli di riordino per prodotto × sede.

Campi: `id uuid pk`, `restaurant_id uuid fk`, `product_id uuid fk products`, `min_quantity numeric check ≥ 0`, `max_quantity numeric check ≥ 0`, `target_quantity numeric check ≥ 0`, `current_declared_stock numeric nullable`, `last_declared_at timestamptz nullable`, `last_declared_by_member_id uuid nullable`, `preferred_supplier_id uuid nullable fk suppliers`, `auto_push_to_bacheca boolean default true`, `created_at`, `updated_at`.

Unique: `(restaurant_id, product_id)`.
Check: `min_quantity ≤ target_quantity ≤ max_quantity`.

#### `product_price_history`
Snapshot prezzo per prodotto + fornitore + ristorante. Alimenta trend e alert inflazione.

Campi: `id uuid pk`, `product_id uuid fk products`, `supplier_id uuid fk suppliers`, `restaurant_id uuid fk restaurants`, `unit_price numeric`, `sales_unit_id uuid nullable`, `source_order_id uuid nullable fk orders`, `observed_at timestamptz default now()`, `created_at`.

Index: `(restaurant_id, product_id, supplier_id, observed_at desc)` per query "ultimo prezzo visto".

Scrittura via trigger `after insert on order_items` quando `orders.status = 'submitted'`.

#### `receipt_checks`
Ricevimento fisico di una consegna. Lega supplier-side `deliveries` al controllo ristoratore.

Campi: `id uuid pk`, `order_split_id uuid fk order_splits`, `delivery_id uuid nullable fk deliveries` (supplier Fase 1), `restaurant_id uuid fk`, `warehouse_location text nullable` (se multi-punto riceve: es. "cucina calda"), `received_by_member_id uuid fk restaurant_members`, `received_at timestamptz`, `status receipt_status default 'pending'`, `signature_url text nullable`, `ddt_url text nullable` (foto/PDF DDT cartaceo ricevuto), `carrier_name text nullable`, `notes text nullable`, `created_at`, `updated_at`.

Status enum `receipt_status`: `pending | partial | completed | refused`.

#### `receipt_check_items`
Righe controllate al ricevimento.

Campi: `id uuid pk`, `receipt_check_id uuid fk`, `order_item_id uuid fk order_items`, `quantity_expected numeric`, `quantity_received numeric check ≥ 0`, `unit_id uuid nullable`, `lot_code text nullable` (da DDT fornitore), `expiry_date date nullable`, `condition receipt_item_condition default 'ok'`, `photo_urls text[] default '{}'`, `notes text nullable`, `issue_id uuid nullable fk order_issues` (se aperta da questa riga), `created_at`.

Condition enum `receipt_item_condition`: `ok | damaged | wrong_product | missing | expired | short_qty`.

#### `receipt_temperature_logs`
Log temperature al ricevimento — obbligatorio HACCP per refrigerati/surgelati.

Campi: `id uuid pk`, `receipt_check_id uuid fk`, `category temperature_category`, `recorded_temp_celsius numeric`, `expected_range_min numeric`, `expected_range_max numeric`, `is_compliant boolean generated always as (recorded_temp_celsius between expected_range_min and expected_range_max) stored`, `recorded_by_member_id uuid fk`, `recorded_at timestamptz default now()`, `photo_url text nullable`, `notes text nullable`.

Category enum `temperature_category`: `frozen | refrigerated | ambient`.

Range default seedati in `restaurants.haccp_settings jsonb` (configurabile):
- `frozen`: -18 / -15 °C
- `refrigerated`: 0 / 4 °C (con override per pesce fresco 0/2, carne 0/4)
- `ambient`: nessun check (nullable min/max)

#### `order_issues`
Pratica non-conformità formale collegata all'ordine.

Campi: `id uuid pk`, `order_id uuid fk orders`, `receipt_check_id uuid nullable fk receipt_checks`, `supplier_id uuid fk suppliers`, `opened_by_member_id uuid fk restaurant_members`, `type issue_type`, `description text`, `requested_credit_amount numeric nullable check ≥ 0`, `status issue_status default 'open'`, `resolved_at timestamptz nullable`, `resolved_credit_amount numeric nullable`, `partnership_thread_id uuid nullable fk partnership_messages` (primo messaggio che avvia discussione), `attachments jsonb default '{}'`, `created_at`, `updated_at`.

Type enum `issue_type`: `missing_item | wrong_item | damaged | expired | temperature_out_of_range | quantity_mismatch | wrong_price | other`.
Status enum `issue_status`: `open | acknowledged | in_progress | resolved | credited | closed_no_action`.

#### `order_issue_events`
Timeline/audit events dell'issue.

Campi: `id uuid pk`, `issue_id uuid fk`, `event_type issue_event_type`, `actor_role text check in ('restaurant','supplier','system')`, `actor_member_id uuid nullable`, `note text nullable`, `metadata jsonb default '{}'`, `created_at timestamptz default now()`.

Event type enum `issue_event_type`: `opened | supplier_acknowledged | credit_proposed | credit_accepted | credit_refused | resolved | closed | reopened`.

#### `supplier_ratings`
Valutazione post-consegna del ristoratore al fornitore.

Campi: `id uuid pk`, `restaurant_id uuid fk`, `supplier_id uuid fk suppliers`, `order_id uuid fk orders`, `rating_punctuality int check 1-5`, `rating_quality int check 1-5`, `rating_service int check 1-5`, `comment text nullable`, `rated_by_member_id uuid fk`, `created_at`.

Unique: `(order_id)` — un solo rating per ordine.

Trigger `after insert/update/delete`: aggiorna `suppliers.rating_avg` e `suppliers.rating_count` (media ponderata delle 3 dimensioni).

#### `notification_preferences_restaurant`
Opt-in per membro × evento × canale.

Campi: `id uuid pk`, `restaurant_member_id uuid fk`, `channel notification_channel`, `event_type notification_event_restaurant`, `enabled boolean default true`, `updated_at`.

Unique: `(restaurant_member_id, channel, event_type)`.

Default: tutti gli eventi `enabled=true` su canale `email` e `push`; `sms` solo se il ruolo ha `subscription.plan_includes_sms = true` (Fase 2+).

### 3.2 Modifiche a tabelle esistenti

- **`restaurants`**:
  - Add `approval_threshold numeric nullable` (NULL = mai approvazione; 0 = sempre; X > 0 = sopra X euro)
  - Add `feature_flags jsonb default '{}'::jsonb`
  - Add `haccp_settings jsonb default '{}'::jsonb` (range temp custom per categoria, responsabile HACCP, manual_version)
  - Add `preferred_receiving_window jsonb nullable` (es. `{"from": "08:00", "to": "11:00"}`)

- **`orders`**:
  - Add `created_by_member_id uuid nullable fk restaurant_members`
  - Add `approval_status order_approval_status default 'not_required'`
  - Add `approved_by_member_id uuid nullable fk restaurant_members`
  - Add `approved_at timestamptz nullable`
  - Add `approval_notes text nullable`
  - Add `recurring_source_id uuid nullable fk recurring_orders`
  - Add `template_source_id uuid nullable fk order_templates`
  - Extend `orders.status` with values: `draft | pending_approval | rejected_internal` (in aggiunta a quelli esistenti)

- **`order_items`**:
  - Add `delivery_location_id uuid nullable fk restaurants` (per ordini cross-sede)
  - Add `historical_unit_price numeric nullable` (snapshot prezzo precedente al momento dell'aggiunta)
  - Add `added_from_bacheca_id uuid nullable fk to_order_items`

### 3.3 Nuovi enum

- `restaurant_role`: `owner | manager | chef | viewer`
- `order_approval_status`: `not_required | pending | approved | rejected`
- `to_order_status`: `open | in_draft | ordered | cancelled`
- `to_order_source`: `manual | par_level | template_run | recurring_run`
- `recurring_frequency`: `daily | weekly | biweekly | monthly`
- `receipt_status`: `pending | partial | completed | refused`
- `receipt_item_condition`: `ok | damaged | wrong_product | missing | expired | short_qty`
- `temperature_category`: `frozen | refrigerated | ambient`
- `issue_type`: `missing_item | wrong_item | damaged | expired | temperature_out_of_range | quantity_mismatch | wrong_price | other`
- `issue_status`: `open | acknowledged | in_progress | resolved | credited | closed_no_action`
- `issue_event_type`: `opened | supplier_acknowledged | credit_proposed | credit_accepted | credit_refused | resolved | closed | reopened`
- `notification_event_restaurant`: `order_submitted | order_accepted_by_supplier | order_modified_by_supplier | order_shipped | order_delivered | approval_needed | approval_decided | issue_opened | issue_updated | issue_credited | par_level_low | recurring_triggered | recurring_sent | delivery_failed | new_partnership_request | new_message_from_supplier | new_price_list_assigned`

Riuso enum esistenti dal supplier Fase 1: `notification_channel` (`email | push | sms`), `user_role`.

### 3.4 Viste materializzate e viste

- **`mv_restaurant_spending_daily(restaurant_id, day, supplier_id, category, amount, orders_count)`** — refresh ogni 15 min + on-demand post submit. Alimenta dashboard KPI e analytics preview.
- **`v_reorder_suggestions(restaurant_id, product_id, par_level_id, min_quantity, target_quantity, current_declared_stock, suggested_quantity, preferred_supplier_id, urgency)`** — live view; `suggested_quantity = target - current`, `urgency = 'critical' if current < min / 2 else 'warning' if current < min else null`.
- **`v_supplier_performance(supplier_id, restaurant_id, ratings_avg_punctuality, ratings_avg_quality, ratings_avg_service, issues_count_90d, issues_resolved_rate_90d, on_time_delivery_rate_90d, total_spent_90d)`** — performance fornitore dal punto di vista ristoratore.
- **`v_price_trend_30d(restaurant_id, product_id, supplier_id, avg_price_30d, last_price, first_price_30d, delta_pct, samples_count)`** — trend prezzo ultimi 30gg.

## 4. Architettura componenti e routing

### 4.1 Routing `app/(app)/`

```
app/(app)/
├── dashboard/page.tsx                          [AGGIORNATA KPI real + sede switcher]
├── da-ordinare/page.tsx                        [NUOVO bacheca condivisa]
├── carrello/page.tsx                           [AGGIORNATA: draft → approva → invia]
├── ordini/
│   ├── page.tsx                                [AGGIORNATA: tab Attivi|Bozze|Approvazioni|Storico]
│   ├── [id]/
│   │   ├── page.tsx                            [AGGIORNATA dettaglio con tracking]
│   │   ├── conferma/page.tsx                   [ESISTENTE — integrata nel nuovo flow]
│   │   ├── approva/page.tsx                    [NUOVO approvazione owner/manager]
│   │   ├── ricevi/page.tsx                     [NUOVO wizard ricevimento HACCP]
│   │   └── contesta/page.tsx                   [NUOVO apertura non-conformità]
│   ├── ricorrenti/
│   │   ├── page.tsx                            [NUOVO]
│   │   └── [id]/page.tsx                       [NUOVO]
│   ├── ordini-tipo/
│   │   ├── page.tsx                            [NUOVO templates]
│   │   └── [id]/page.tsx                       [NUOVO]
│   └── valuta/[orderId]/page.tsx               [NUOVO rating post-consegna]
├── ricevimenti/
│   ├── page.tsx                                [NUOVO — in arrivo + storico]
│   └── [id]/page.tsx                           [NUOVO dettaglio + temp log]
├── non-conformita/
│   ├── page.tsx                                [NUOVO lista issue]
│   └── [id]/page.tsx                           [NUOVO timeline + chat integrata]
├── cerca/                                      [AGGIORNATA con price trend inline]
│   ├── page.tsx
│   └── [productId]/page.tsx                    [AGGIORNATA storico prezzi + par level]
├── fornitori/
│   ├── page.tsx                                [AGGIORNATA badge performance + msg non letti]
│   ├── [id]/
│   │   ├── page.tsx                            [AGGIORNATA tab Catalogo|Performance|Messaggi]
│   │   ├── performance/page.tsx                [NUOVO scheda 360°]
│   │   └── messaggi/page.tsx                   [IN FLIGHT — integrato]
│   └── cerca/page.tsx                          [IN FLIGHT — integrato]
├── cataloghi/                                  [ESISTENTE, confronta già presente]
├── analytics/
│   ├── page.tsx                                [AGGIORNATA con dati reali base]
│   └── spesa/page.tsx                          [NUOVO preview spesa per fornitore/categoria]
└── impostazioni/
    ├── page.tsx
    ├── profilo/page.tsx                        [ESISTENTE]
    ├── sedi/page.tsx                           [ESISTENTE arricchita]
    ├── team/page.tsx                           [AGGIORNATA: ruoli + permessi + inviti]
    ├── approvazione/page.tsx                   [NUOVO soglia + matrice]
    ├── notifiche/page.tsx                      [NUOVO canali × eventi]
    ├── par-levels/page.tsx                     [NUOVO setup livelli riordino]
    ├── haccp/page.tsx                          [NUOVO range temp + responsabile + export]
    ├── esigenze-fornitura/page.tsx             [ESISTENTE]
    └── abbonamento/page.tsx                    [ESISTENTE]
```

### 4.2 Sidebar e mobile nav

**Sidebar desktop (progressive):**

| Voce | Icona | Basic | Standard | Advanced |
|---|---|:-:|:-:|:-:|
| Dashboard | `LayoutDashboard` | ✅ | ✅ | ✅ |
| Da Ordinare (badge count) | `ClipboardCheck` | opt-in | ✅ | ✅ |
| Carrello / Bozze | `ShoppingCart` | ✅ | ✅ | ✅ |
| Ordini | `ClipboardList` | ✅ | ✅ | ✅ |
| Ricevimenti (badge oggi) | `PackageCheck` | ✅ | ✅ | ✅ |
| Non-conformità (badge open) | `AlertTriangle` | — | ✅ | ✅ |
| Cerca Prodotti | `Search` | ✅ | ✅ | ✅ |
| Fornitori (badge msg) | `Store` | ✅ | ✅ | ✅ |
| Cataloghi | `BookMarked` | opt-in | ✅ | ✅ |
| Analytics | `BarChart3` | preview | ✅ | ✅ |
| Impostazioni | `Settings` | ✅ | ✅ | ✅ |

**Sede switcher** in topbar se `sedi_count > 1`. Default: sede primary. Alcune pagine sono per-sede (Bacheca, Par Levels, Ricevimenti), altre per-profilo (Fornitori, Cataloghi, Impostazioni).

**Mobile bottom nav (5 voci):**
1. Home
2. Da Ordinare (con FAB `+` per quick-add)
3. Ordini
4. Ricevimenti
5. Altro (menu con tutto il resto)

### 4.3 Progressive disclosure — algoritmo

```
function getRestaurantDisclosureLevel(profile):
  IF sedi_count >= 2 OR team_size >= 5 OR orders_last_30d >= 30 OR par_levels_count >= 10:
    return 'advanced'
  ELSE IF team_size >= 2 OR orders_last_30d >= 5 OR approval_threshold IS NOT NULL:
    return 'standard'
  ELSE:
    return 'basic'
```

**Basic — bar/trattoria singolo operatore:**
- Workflow: ricerca → carrello → invia (no draft stage, no approvazione)
- Dashboard: 3 KPI (spesa mese, ordini in corso, risparmio)
- Ricevimento: 1 click "ricevuto tutto", form aperto solo se clicca "c'è un problema"
- Non-conformità e Par Levels nascosti finché non li attiva
- Onboarding propone attivazione funzionalità extra dopo 3 ordini

**Standard — ristorante con brigata:**
- Aggiunge: bacheca Da Ordinare, ordine-tipo, approvazione con soglia, 4 ruoli team, ricevimento con temperature log
- Dashboard: 6 KPI + trend + "in scadenza oggi" (lotti ricevuti)
- Cataloghi + Confronta visibili di default

**Advanced — multi-sede o catena:**
- Aggiunge: sede switcher topbar, ordini ricorrenti programmati visibili, par levels automatici, scheda performance fornitore 360°, export CSV/PDF
- Dashboard: KPI aggregati + filtro sede + alert par level
- Analytics: tab "Confronto sedi"

Override manuale in Impostazioni → "Modalità interfaccia: Semplice / Standard / Completa".

### 4.4 Componenti chiave (nuovi)

**`components/restaurant/`**

Order building:
- `bacheca/to-order-board.tsx` — bacheca condivisa con raggruppamento auto per fornitore preferito
- `bacheca/quick-add-dialog.tsx` — aggiunta rapida con autocomplete (product catalog + free text)
- `orders/order-approval-panel.tsx` — card approva/rifiuta con note
- `orders/draft-orders-table.tsx` — tabella bozze con badge stato approvazione
- `orders/recurring-order-form.tsx` — configurazione schedulazione cron-friendly
- `orders/order-template-editor.tsx` — editor ordine-tipo con drag & drop righe

Ricevimento:
- `receiving/receipt-check-form.tsx` — wizard 4 step (temp / count / foto / firma)
- `receiving/temperature-log-input.tsx` — input temp con auto-check range
- `receiving/photo-upload.tsx` — upload foto difetti su Supabase Storage `restaurant-receipts/`

Non-conformità:
- `issues/issue-open-dialog.tsx` — apri issue pre-compilata da riga ricevimento
- `issues/issue-timeline.tsx` — timeline eventi + chat `partnership_messages` embedded
- `issues/credit-negotiation-card.tsx` — UI proposta/accettazione credito

Fornitori / pricing:
- `suppliers/supplier-performance-card.tsx` — 360°: puntualità %, qualità media, non-conformità 90gg
- `suppliers/supplier-rating-dialog.tsx` — 3 stelle + commento post-consegna
- `pricing/price-trend-badge.tsx` — badge inline "€X (+3% vs ultimo ordine)"
- `pricing/price-history-chart.tsx` — mini chart storico prezzo per prodotto

Par levels:
- `par-levels/par-level-row-editor.tsx` — editor min/max/target
- `par-levels/reorder-suggestions-panel.tsx` — pannello "Sotto minimo"

Settings:
- `settings/approval-threshold-form.tsx` — slider soglia + preview impatto
- `settings/notification-preferences-matrix.tsx` — matrice canali × eventi
- `settings/haccp-settings-form.tsx` — range temp per categoria + responsabile

**`lib/restaurant/`** (nuovi moduli, pattern `actions.ts + queries.ts + schemas.ts + types.ts`):
- `bacheca/` — CRUD bacheca
- `orders/drafts.ts` — logic approvazione soglia
- `orders/templates.ts` — CRUD ordini-tipo
- `orders/recurring.ts` — schedulazione + worker trigger
- `par-levels/engine.ts` — calcolo suggerimenti + auto-push in bacheca
- `receiving/actions.ts` — RPC `confirm_receipt_with_checks` (atomica)
- `issues/actions.ts` — workflow stato con audit events
- `pricing/history.ts` — trigger snapshot + query trend
- `ratings/actions.ts` — submit rating + trigger aggiornamento supplier
- `notifications/sender.ts` — fan-out multi-canale
- `authz/permissions.ts` — helper `hasRestaurantPermission(memberId, perm)` via RPC (SECURITY DEFINER)

### 4.5 Integrazione con supplier Fase 1 — punti di contatto

Eventi incrociati ristoratore ↔ fornitore:

| Evento ristoratore → fornitore | Effetto lato supplier (esistente) |
|---|---|
| Invio ordine | `orders → order_splits → order_split_items` creati (logic esistente) |
| Apertura non-conformità | Notifica supplier (`issue_opened`) + messaggio auto in `partnership_messages` con link a issue |
| Rating post-consegna | Trigger aggiorna `suppliers.rating_avg`, `rating_count` |

| Evento supplier → ristoratore | Effetto lato restaurant (nuovo) |
|---|---|
| Supplier accetta/modifica riga | Se modificato → notifica push/email ristoratore, banner "Fornitore ha modificato l'ordine" → flow `/ordini/[id]/conferma` esistente |
| Supplier spedisce (`delivery.loaded`) | Notifica "Consegna in arrivo oggi" + appare in `/ricevimenti` |
| Supplier genera DDT | `ddt_documents.pdf_url` esposto, scaricabile da dettaglio ordine |
| Lotto consegnato da DDT | Pre-popola `receipt_check_items.lot_code` + `expiry_date` |

**Nessuna modifica al data model supplier.** Solo utilizzo di quello esistente.

## 5. Workflow end-to-end

### 5.1 Da bacheca a ordine inviato

**Step 1 — Popolamento bacheca (3 sorgenti)**

| Sorgente | Trigger | Attore |
|---|---|---|
| Manuale | `/da-ordinare` → "+" → insert `to_order_items` con `source = 'manual'` | Membri con `order.draft` |
| Auto par level | `par_levels.current_declared_stock < min_quantity` AND `auto_push_to_bacheca = true` → insert con `source = 'par_level'` | Trigger on `par_levels` update + job periodico |
| Auto template run | `recurring_orders.next_run_at ≤ now()` AND `is_active` → popola da `order_template_items`, `source = 'recurring_run'` | pg_cron ogni 10 min |

**Step 2 — Compilazione in draft**

- User seleziona righe dalla bacheca → clicca "Compila ordine"
- Sistema raggruppa per `preferred_supplier_id`; righe senza fornitore → wizard di assegnazione
- Crea N `orders` con `status = 'draft'`, `created_by_member_id = <utente>`
- Per ogni riga: snapshot `historical_unit_price` da `product_price_history`
- Marca `to_order_items.status = 'in_draft'`, `consumed_in_order_id = <order.id>`

**Step 3 — Approvazione (se soglia attiva)**

```
IF orders.total > restaurants.approval_threshold
   AND created_by_member.role NOT IN ('owner')
THEN
   orders.approval_status = 'pending'
   orders.status = 'pending_approval'
   notifica a tutti i membri con permesso 'order.approve' (evento approval_needed)
ELSE
   orders.approval_status = 'not_required'
   GOTO step 4
```

Owner apre `/ordini/[id]/approva` → vede confronto prezzi con storico → approva (firma digitale: nome + timestamp in `approval_notes`) o rifiuta con motivo.

**Step 4 — Invio al fornitore (RPC `submit_order_with_approval`)**

Transazione atomica:
1. `orders.status = 'submitted'`, `submitted_at = now()`
2. Crea `order_splits` + `order_split_items` (riuso supplier Fase 1)
3. Trigger scrive `product_price_history` per ogni riga
4. Evento `order_submitted` → supplier notificato via notification system esistente
5. Marca `to_order_items.status = 'ordered'`

**Step 5 — Tracking**

Stati visibili in `/ordini/[id]`:
- `submitted` → supplier riceve
- `accepted | partially_accepted | rejected` (supplier Fase 1)
- Se `partially_accepted` con modifiche → flow conferma cliente esistente
- `preparing → packed → shipped` → appare in `/ricevimenti` oggi/domani

**Step 6 — Ricevimento (`/ricevimenti/[id]`, wizard 4 step)**

```
Step 1 - Temperature log (solo se ordine contiene refrigerati/surgelati)
  Per ogni categoria: input temp + auto-check range da restaurants.haccp_settings
  Se fuori range → warning + richiesta foto termometro (opzionale)

Step 2 - Count & condition per riga
  Per ogni order_item:
    - qty ricevuta (default = qty attesa)
    - condition: ok | damaged | wrong_product | missing | expired | short_qty
    - lot_code (pre-compilato da DDT supplier se disponibile)
    - expiry_date (pre-compilato)
    - Se condition != 'ok' → bottone "Apri non-conformità" precompila issue

Step 3 - Foto difetti (se almeno 1 riga con condition != 'ok')
  Upload multi-foto su Supabase Storage bucket `restaurant-receipts/{receipt_id}/`

Step 4 - Firma & note
  Upload foto DDT cartaceo ricevuto (opzionale)
  Firma digitale (nome membro + timestamp)
  Click "Conferma ricevimento" → RPC confirm_receipt_with_checks
```

RPC `confirm_receipt_with_checks` (atomica):
- INSERT `receipt_checks` + `receipt_check_items` + `receipt_temperature_logs`
- UPDATE `order_splits.status = 'delivered'` (notifica supplier)
- Se issue pendenti → INSERT `order_issues` + evento `opened` + messaggio auto in `partnership_messages`
- Notifica supplier se issue opened (evento `issue_opened`)
- Ritorna CTA "Valuta fornitore" → `/ordini/valuta/[orderId]`

### 5.2 Non-conformità (ciclo vita)

```
opened (ristoratore apre durante ricevimento)
  ↓ evento 'opened' + messaggio auto in partnership_messages con foto+dettagli
supplier riceve notifica
  ↓
acknowledged (supplier risponde in chat) → evento 'supplier_acknowledged'
  ↓
in_progress (supplier propone credit_amount via messaggio) → evento 'credit_proposed'
  ↓
ristoratore accetta (`credit_accepted`) → credited (`resolved_credit_amount` salvato)
ristoratore rifiuta (`credit_refused`) → torna a in_progress
  ↓
oppure resolved (nessun credito, es. reso + sostituzione)
  ↓
closed (escalation auto dopo 30gg senza interazione, configurabile) → closed_no_action
```

Tutti gli eventi hanno `actor_role` (restaurant/supplier/system) + `created_at`. Timeline visibile a entrambe le parti.

### 5.3 Ordini ricorrenti — trigger

Implementazione: **pg_cron** (Supabase extension). Fallback: Edge Function schedulata se pg_cron non disponibile nel piano.

```sql
-- Ogni 10 min
SELECT run_recurring_orders();
```

Funzione `run_recurring_orders()`:
1. Per ogni `recurring_orders` con `next_run_at ≤ now() AND is_active = true`:
   a. Crea `to_order_items` dalle `order_template_items` (source `recurring_run`)
   b. Se `auto_send = true`:
      - Crea `orders` draft
      - Check soglia approvazione
      - Se non richiesta → esegue `submit_order_with_approval` diretto
      - Se richiesta → `status = 'pending_approval'`, notifica owner
   c. Se `auto_send = false`: rimane in bacheca per compilazione manuale
2. Aggiorna `next_run_at` basato su frequency/day/time/timezone
3. Emette evento `recurring_triggered` (+ `recurring_sent` se `auto_send`)

### 5.4 Engine par levels — auto-push in bacheca

Trigger `after update on par_levels` (quando cambia `current_declared_stock`) + job periodico ogni 4 ore:

```
FOR EACH par_level WHERE current_declared_stock < min_quantity AND auto_push_to_bacheca:
  IF NOT EXISTS(
    SELECT 1 FROM to_order_items
    WHERE restaurant_id = par_level.restaurant_id
      AND product_id = par_level.product_id
      AND status IN ('open', 'in_draft')
  ) THEN
    INSERT INTO to_order_items (
      restaurant_id, product_id,
      quantity = target_quantity - current_declared_stock,
      preferred_supplier_id = par_level.preferred_supplier_id,
      source = 'par_level',
      notes = 'Auto-push: sotto par level (' || current || '/' || min || ')'
    );
    emit notification par_level_low se soglia critica
  END IF
END FOR;
```

Dedup: non duplica se esiste già una riga open/in_draft per lo stesso (restaurant, product).

## 6. Feature flag & rollout

**Flag**: `restaurants.feature_flags.phase1_enabled boolean default false`

Strategia:
1. Migration crea tutte le tabelle + colonna flag (default off)
2. Codice nuovo pathing dietro flag — se `false`, UI mostra layout legacy e pagine nuove redirect a `/dashboard`
3. Rollout incrementale:
   - **Alpha (1 settimana)**: ristoratori test selezionati (flag=true manuale via admin)
   - **Beta (2 settimane)**: 10% ristoratori random selezionati
   - **GA**: migration `enable_phase1_platform_wide_restaurants` setta true per tutti (analoga a quella del supplier già usata)
4. Kill-switch: set flag=false → torna al comportamento legacy

**Backfill on migration deploy** (non dipende dal flag):
- Crea `restaurant_members` owner-row per ogni `restaurants` esistente
- Seed `role_permissions_restaurant` con matrice ruoli
- Nessun backfill per par_levels/templates/bacheca (opt-in, utente crea)

## 7. RLS policies

**Principio**: usare SECURITY DEFINER helper functions invece di EXISTS/IN con policy circolari (memory `feedback_rls_recursion.md`).

Helper RPC:
```sql
CREATE FUNCTION has_restaurant_permission(p_restaurant_id uuid, p_permission text)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_members rm
    JOIN role_permissions_restaurant rp ON rp.role = rm.role
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.profile_id = auth.uid()
      AND rm.is_active
      AND rp.permission = p_permission
  );
$$;

CREATE FUNCTION is_restaurant_member(p_restaurant_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_members
    WHERE restaurant_id = p_restaurant_id
      AND profile_id = auth.uid()
      AND is_active
  );
$$;
```

Policies principali per tabella:

| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `restaurant_members` | `is_restaurant_member(restaurant_id)` OR owner | `has_restaurant_permission(restaurant_id, 'staff.manage')` | Stessa | Stessa |
| `to_order_items` | `has_restaurant_permission(restaurant_id, 'order.draft')` | Stessa | Solo creatore per 24h, poi chef/manager/owner | Stessa |
| `order_templates` | `is_restaurant_member` | `has_restaurant_permission(r, 'template.manage')` | Stessa | Stessa |
| `order_template_items` | Via FK su `order_templates` | Stessa | Stessa | Stessa |
| `recurring_orders` | `is_restaurant_member` | `has_restaurant_permission(r, 'recurring.manage')` | Stessa | Stessa |
| `par_levels` | `is_restaurant_member` | `has_restaurant_permission(r, 'par_levels.manage')` | Stessa | Stessa |
| `product_price_history` | `is_restaurant_member` | Solo trigger (no user INSERT) | No UPDATE | No DELETE |
| `receipt_checks` | `is_restaurant_member` | `has_restaurant_permission(r, 'order.receive')` | Stessa | — |
| `receipt_check_items` | Via FK | Stessa | Stessa | — |
| `receipt_temperature_logs` | Via FK | Stessa | Stessa | — |
| `order_issues` | `is_restaurant_member` OR supplier del partnership | `has_restaurant_permission(r, 'issue.open')` | Ristoratore può update se `issue.resolve`; supplier può update solo `status`/eventi via procedure dedicata | — |
| `order_issue_events` | Via FK (entrambe le parti) | Via procedure (append-only) | No UPDATE | No DELETE |
| `supplier_ratings` | `is_restaurant_member` per proprie + pubbliche per aggregati | `has_restaurant_permission(r, 'rating.submit')` | Solo autore entro 24h | — |
| `notification_preferences_restaurant` | Solo `restaurant_member_id` = auth.uid() | Stessa | Stessa | Stessa |
| `restaurants` (mod) | Esistenti | Esistenti | `has_restaurant_permission(id, 'settings.manage')` per nuove colonne | Esistenti |
| `orders` (mod) | Esistenti + membri | `order.submit` o `order.draft` | Stato workflow enforced via trigger | Esistenti |

## 8. Testing strategy

### 8.1 Unit tests (`vitest`)

- `lib/restaurant/orders/drafts.ts` — logic approvazione soglia, selezione approver, rejection path
- `lib/restaurant/par-levels/engine.ts` — calcolo suggerimenti, dedup, urgency levels
- `lib/restaurant/receiving/validators.ts` — range temperatura HACCP, condition validation
- `lib/restaurant/pricing/history.ts` — calcolo trend 30gg, delta %, samples count
- `lib/restaurant/authz/permissions.ts` — matrice permessi per ruolo
- `lib/restaurant/orders/recurring.ts` — calcolo `next_run_at` per ogni frequency × timezone

### 8.2 Integration tests (Supabase local + `supabase test db`)

- RPC `submit_order_with_approval` — ramo con/senza soglia, ramo rifiuto, transazionalità
- RPC `confirm_receipt_with_checks` — atomicità: se fallisce insert temp_log, rollback receipt completo
- RPC `run_recurring_orders` — trigger corretto per frequency, niente doppi invii, handling timezone DST
- RLS — smoke test per ogni ruolo: owner vede tutto, viewer solo read, chef no approve, etc.
- Trigger `product_price_history` — scrive correttamente on insert order_items, dedup temporale
- Trigger `supplier_ratings` → `suppliers.rating_avg` — aggiornamento corretto media/count

### 8.3 E2E (Playwright) — journey chiave

1. **Piccolo ristoratore (basic)**: login → ricerca → carrello → invia → supplier mock accetta → ricevi 1-click → valuta
2. **Medio con approvazione (standard)**: chef aggiunge a bacheca → compila draft → blocco soglia → owner approva → invio → ricevimento foto + apertura issue
3. **Ordine ricorrente (advanced)**: crea template + recurring → simula cron → verifica auto_send vs pending_approval
4. **Multi-sede (advanced)**: owner ordina per sede diversa → `delivery_location_id` → ricevimento da sede B
5. **Non-conformità completa**: apertura → supplier risponde → proposta credito → accetta → verifica stato `credited`
6. **Progressive disclosure**: verifica UI cambia quando team cresce da 1 a 5 membri

## 9. Decomposizione in plan

Come per supplier Fase 1, 4 plan sequenziali deployabili indipendentemente dietro feature flag:

### Plan 1A — Team & Fondamenta (2-3 settimane)

Scope:
- Migration `restaurant_members`, `role_permissions_restaurant` con seed matrice
- Migration `restaurants.feature_flags`, `restaurants.approval_threshold`, `restaurants.haccp_settings`
- Backfill owner membership per restaurants esistenti
- Helper RPC `has_restaurant_permission`, `is_restaurant_member`
- UI `impostazioni/team` rifatta con ruoli + inviti
- UI `impostazioni/approvazione` per soglia
- Feature flag infrastructure + kill-switch
- Integrazione con auth esistente

### Plan 1B — Order Building (3-4 settimane)

Scope:
- Migration `to_order_items`, `order_templates`, `order_template_items`, `recurring_orders`, `par_levels`, `product_price_history`
- Mod `orders` (approval_*, recurring_source_id, template_source_id) e `order_items` (delivery_location_id, historical_unit_price, added_from_bacheca_id)
- RPC `submit_order_with_approval` con soglia logic
- pg_cron setup per `run_recurring_orders()`
- Par levels engine + auto-push in bacheca
- UI `/da-ordinare` (bacheca)
- UI `/ordini/ordini-tipo`, `/ordini/ricorrenti`
- UI `/impostazioni/par-levels`
- UI price trend badge inline in `/cerca` e `/cerca/[productId]`
- Workflow draft → approval → submit integrato con carrello esistente

### Plan 1C — Ricevimento & HACCP (2-3 settimane)

Scope:
- Migration `receipt_checks`, `receipt_check_items`, `receipt_temperature_logs`, `order_issues`, `order_issue_events`, `supplier_ratings`
- Mod `restaurants.haccp_settings` seed default ranges
- RPC `confirm_receipt_with_checks` atomica
- Storage bucket `restaurant-receipts/` con RLS
- UI `/ricevimenti` lista + dettaglio
- UI `/ordini/[id]/ricevi` wizard 4 step
- UI `/non-conformita` lista + dettaglio timeline
- UI `/ordini/valuta/[orderId]` rating 3 stelle
- UI `/impostazioni/haccp`
- Trigger update `suppliers.rating_avg` da `supplier_ratings`
- Integrazione con `partnership_messages` per issue chat
- Integrazione con DDT supplier (scarica PDF, pre-compila lotti)

### Plan 1D — Notifiche & Dashboard (2 settimane)

Scope:
- Migration `notification_preferences_restaurant` con seed default
- Riuso `push_subscriptions` esistente
- Fan-out service in `lib/restaurant/notifications/sender.ts` (email Resend/SendGrid + push web + in-app)
- Email templates per eventi ristoratore
- UI `/impostazioni/notifiche` matrice canali × eventi
- Dashboard rifatta con KPI reali (`mv_restaurant_spending_daily`, trend sparkline, alert par level, ricevimenti oggi, non-conformità aperte)
- View materializzate + refresh strategy
- Scheda fornitore `/fornitori/[id]/performance` con `v_supplier_performance`
- Analytics preview `/analytics/spesa` con spesa per fornitore/categoria
- Mobile nav completo + progressive disclosure finale polish
- E2E tests sui 6 journey

**Totale: ~10-12 settimane**, stesso ordine del supplier Fase 1.

## 10. Stack decisions

- **Database**: Supabase (PostgreSQL 15+) — già in uso
- **Cron**: pg_cron (Supabase extension); fallback Supabase Scheduled Function
- **Email**: Resend (già in uso in `lib/notifications/email.ts` dal supplier Fase 1); riuso `sendEmail()` per tutte le email ristoratore
- **Push web**: Web Push API con VAPID keys (già impostato nel supplier Fase 1)
- **Storage**: Supabase Storage bucket nuovo `restaurant-receipts/` per foto ricevimento; RLS per accesso ristretto
- **Validation**: Zod v4 (import da `zod/v4`)
- **UI**: coerente con convenzioni esistenti (Tailwind CSS 4 con `@theme`, componenti `components/ui/`, `components/dashboard/`)
- **Testing**: vitest (unit), supabase test db (integration), Playwright (E2E)

## 11. Rischi & mitigazioni

| Rischio | Mitigazione |
|---|---|
| Complessità RLS con tabelle cross-party (issues, ratings) | Helper SECURITY DEFINER; smoke test RLS per ruolo in CI |
| Performance `mv_restaurant_spending_daily` con molti ristoranti | Refresh incrementale + indici su (restaurant_id, day) |
| pg_cron non disponibile su tier Supabase | Fallback Edge Function schedulata dichiarato nel Plan 1B |
| Conflitti migrazione con branch `feat/cataloghi-ristoratore` in flight | Ordine migration: attendi merge branch corrente prima di iniziare 1A; renumber se servono migrations intermedie |
| Foto difetti su storage illimitate | Soft limit per ristorante (es. 500MB su free tier) + cleanup dopo 2 anni |
| Adoption bacheca/par levels bassa (troppo complicato) | Onboarding progressivo: attiva feature dopo N ordini; tutorial video in-app |
| Email deliverability | Scelta provider affidabile (Resend/Postmark) + DKIM/SPF configurati |
| HACCP compliance reale per export ASL | Fase 1 fornisce dati strutturati; export formale ASL in Fase 5 (compliance) |

## 12. Note di integrazione con branch in flight

Il branch `feat/cataloghi-ristoratore` ha già introdotto:
- `restaurant_suppliers` (partnership)
- `partnership_messages` (thread per relazione)
- `supplier_price_lists` (listini visibili al ristoratore)
- Estensioni `restaurant_catalogs`
- Auto-provisioning on signup
- `enable_phase1_platform_wide` per supplier Fase 1

Fase 1 ristoratore:
- **Riusa** queste tabelle senza modificarle
- **Collega** `order_issues.partnership_thread_id` a `partnership_messages`
- **Collega** notifiche `new_partnership_request`, `new_message_from_supplier`, `new_price_list_assigned` al notification system
- **Aggiunge** UI per scheda performance fornitore integrando `partnership_messages` come timeline
- **Attende** merge del branch corrente prima di iniziare Plan 1A (ordine migration)

---

**Fine spec.** Prossimo passo: `writing-plans` skill per decomporre Plan 1A (Team & Fondamenta).
