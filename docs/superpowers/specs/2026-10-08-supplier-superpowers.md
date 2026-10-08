# Supplier superpowers — making GastroBridge indispensable for an Italian Ho.Re.Ca. distributor

Date: 2026-10-08 · Scope: supplier area `app/(supplier)` + `lib/supplier/*` ·
Branch: `feat/supplier-superpowers`

## 0. Who we design for

An Italian food-service distributor (ortofrutta, carni, ittico, beverage,
food service generalista) with 50–600 active restaurant clients and a small
team, each person with a very different day:

| role | where they work | what they need from the app |
|---|---|---|
| **admin** (titolare) | office + phone | one screen that says what is late, what is at risk, who is not paying, who stopped ordering |
| **sales** (commerciale / agente) | phone, WhatsApp, car | key an order in 30 s while the cook is on the phone, see the client's listino, fido and history, spot clients slipping away |
| **warehouse** (magazziniere) | warehouse floor, gloves, tablet | what to pick now, what is short, what expires first (FEFO), what to reorder |
| **driver** (autista) | van, phone in one hand | stops in order, one tap to navigate / call / warn the client, POD |

## 1. Research — what best-in-class tools do, and the Italian pain points

Market scan (Pepper, Choco + CustomerHub, Cut+Dry, GrubMarket WholesaleWare,
Sodapp, Sirvis, Ordiniamo, Wendoapp, plus ERP credit-hold docs):

* **Orders still arrive by phone, WhatsApp voice notes, photos of handwritten
  lists.** Every serious vendor now sells an "order desk" that turns
  texts/calls into orders (Pepper, Choco AI, Cut+Dry AI Order Desk, Sodapp on
  WhatsApp). In Italy this is *the* channel for Ho.Re.Ca.: the chef calls at
  23:30 after service or sends a vocal at 6:00. Pain: re-keying, mistakes,
  orders lost in personal phones of agents.
* **Cut-off per route/zone.** Pepper derives the cut-off from the delivery
  route and shows "order by X for delivery on Y" at order time; after cut-off
  the order slides to the next route. Distributors live by "entro le 18 per
  domani".
* **Substitutions with customer approval.** Pepper/consumer grocery apps:
  when an item is short, propose the closest in-stock alternative and let the
  customer approve; respect "no substitute" customers.
* **Churn / "non ordina più" alerts.** Choco CustomerHub: last order, expected
  next order, frequency shifts, products that fell off the basket, upsell
  prompts for reps. This is what keeps agents' books growing.
* **Credit control.** ERPs warn when an order would push a client over its
  credit limit (fido) and allow a hold; the useful version warns *before*
  confirming, not after delivery. Italian reality: payment at 30/60/90 gg
  DF FM, insoluti, "cliente bloccato in amministrazione".
* **Route & driver UX.** Ordered stop list, deep links to Google Maps/Waze,
  "arrivo tra 15 minuti" messages, POD photo + signature. No need for a paid
  routing API at this size: 10–40 stops/day/van.
* **Price lists at scale.** Category-wide % changes (listino +3% su
  ortofrutta), changes with an effective date communicated in advance to
  clients (legally and commercially important in Italy), margin visibility
  vs. purchase cost.

Sources: usepepper.com (item substitutions, compare pages), Pepperi support
(delivery cut-off per account), choco.com (CustomerHub, AI order capture),
cutanddry.com, GrubMarket WholesaleWare release notes, Sodapp, Sirvis,
Homesource AR credit alerts, Dynamics GP credit hold notes.

## 2. What GastroBridge already has (end-to-end study)

* Orders: `order_splits` per supplier, line-level accept/modify/reject
  (`acceptOrderLines`), workflow sub-states encoded in `supplier_notes`
  (`pending_customer_confirmation`, `stock_conflict`, `packed`), HMAC
  customer-confirmation page, kanban, FEFO picking (`pick_split_tx`),
  packing → deliveries `loaded` → auto DDT.
* Deliveries: list per day, calendar, driver assignment, POD photo +
  signature, failure reasons. Zones with `delivery_days`, `cutoff_time`,
  `delivery_slots`.
* Stock: lots with expiry + `cost_per_base` (from carichi), reservations,
  `low_stock_threshold` per product, `mv_stock_at_risk`.
* Pricing: `price_lists` + items + tier discounts + `customer_price_assignments`;
  bulk % per category on a list; legacy per-relationship `supplier_price_lists`.
* Clients: `restaurant_suppliers` relationships, chat (`partnership_messages`,
  also per-order threads), reviews.
* Notifications: in-app + email + web push dispatcher keyed by role.
* Gaps: the dashboard is the same for every role (drivers see revenue
  charts), nothing tells *what to do now*; no stock visibility while accepting
  an order; no substitution flow; no route order or driver-friendly view; no
  client cadence/churn view; no credit limit; price changes are immediate and
  silent; no way for sales to key a phone order.

## 3. Prioritised backlog (impact × effort)

Impact 1–5 (time saved / revenue protected per day), effort S/M/L.
Data availability: ✅ existing data, ➕ additive column/table, ⏳ needs data we
do not have.

| # | Feature | Impact | Effort | Data | Decision |
|---|---|---|---|---|---|
| 1 | **"Oggi" command center**, role-aware | 5 | M | ✅ | **Build** |
| 2 | **Smart intake**: stock coverage per order, bulk accept of fully covered orders | 5 | M | ✅ | **Build** |
| 3 | **Substitution suggestions** for short lines, proposal sent to client | 4 | M | ✅ | **Build** (restaurant one-tap approval deferred) |
| 4 | **Giro consegne + driver mode** (ordered stops, deep links, ETA message) | 5 | M | ✅ + ➕ `deliveries.route_position` | **Build** |
| 5 | **Customer intelligence** (cadence, at-risk, fall-off, upsell from similar clients) | 5 | M | ✅ | **Build** |
| 6 | **Credit control** (fido, termini, blocco, esposizione) | 4 | S | ➕ `supplier_customer_terms` | **Build** |
| 7 | **Scheduled price changes** with client notice + **margin view** | 4 | M | ✅ + ➕ `scheduled_price_changes` | **Build** |
| 8 | **Phone / WhatsApp order entry** by sales on behalf of a client | 5 | M | ✅ | **Build** (free-text parser = deterministic matcher + hook for `lib/ai/import`) |
| 9 | Reorder suggestions for the warehouse (open demand vs. available vs. reorder point) | 3 | S | ✅ | **Build inside #1** (warehouse view) |
| 10 | Returns / resi & note di credito | 4 | L | ⏳ no returns model, no invoicing | Defer |
| 11 | Invoicing / SDI e-fattura, scadenzario incassi | 5 | L | ⏳ no invoices/payments | Defer — exposure is computed from orders + payment terms instead |
| 12 | Real route optimisation (TSP with road times) | 3 | L | ⏳ paid API | Defer — nearest-neighbour on lat/lng, then zone/CAP fallback |
| 13 | Cut-off enforcement at restaurant checkout | 4 | M | ✅ | Defer — restaurant area is owned by another agent; supplier side shows the countdown |
| 14 | AI parsing of WhatsApp vocal/photo orders | 5 | L | — | Defer — owned by the `lib/ai/import` agent; hook left in #8 |

## 4. Feature specs

### 4.1 "Oggi" — `/supplier/oggi` (all roles)

*Problem.* Every role opens the app and has to hunt across Ordini, Consegne,
Magazzino to know what to do.

*UX.* One page, sections ordered by urgency and filtered by role:

* Header: date, live **cut-off countdown** to the next zone cut-off of the day
  (`delivery_zones.cutoff_time` for zones that deliver tomorrow), and 4 KPI
  tiles (da confermare, da preparare, consegne oggi, problemi).
* **Da confermare** (admin, sales): pending splits oldest first, client, value,
  age, *stock coverage* chip (coperto / parziale / scoperto), fido chip; select
  + "Accetta selezionati" (only fully covered ones are pre-selected).
* **Coda preparazione** (admin, warehouse): confirmed/preparing splits by
  expected delivery date (today, tomorrow, later), line count, link to picking.
* **Consegne di oggi** (admin, warehouse, driver — driver sees only own):
  progress planned/loaded/in transit/delivered/failed + link to Giro.
* **Problemi**: stock conflicts, client confirmations waiting >24 h, failed
  deliveries in the last 3 days, orders with expected date passed.
* **Magazzino** (admin, warehouse): products under reorder point with open
  demand (reorder suggestion = demand + threshold − available), lots expiring
  in 3 days.
* **Clienti da richiamare** (admin, sales): top 5 at-risk clients from 4.5.
* Dashboard: warehouse and driver roles are redirected from `/supplier/dashboard`
  to `/supplier/oggi` (they must not see financial KPIs); "Oggi" is the first
  nav entry and the first mobile tab.

*Data.* `order_splits`, `order_split_items`, `product_sales_units`,
`stock_lots`, `deliveries`, `delivery_zones`, `order_split_events`.

### 4.2 Smart intake

*Problem.* The supplier accepts an order and only discovers at reservation
time (`stock_conflict`) that stock is short; accepting 30 morning orders one
by one is slow.

*UX.* Coverage per line = requested qty × `conversion_to_base` vs. available
(`quantity_base − quantity_reserved_base` across the supplier's warehouses).
Order detail shows per-line "Disponibile: X · scade il …" (FEFO first lot) and
a red "scoperto" chip; Oggi shows per-order coverage; **bulk accept** runs the
existing `acceptOrderLines` (all accept) for each selected split, so
reservation, events and notifications stay identical. Permission:
`order.accept_line` (checked again server-side per split).

### 4.3 Substitution suggestions

*UX.* For a short line the detail lists up to 3 alternatives: same
`category_id` (same `subcategory_id` ranked first), available, in stock for the
requested qty, unit price within ±30 % (ranked by price distance, then stock).
"Proponi" marks the line *rifiutata* with reason
`Non disponibile — proposta alternativa: <nome> (<prezzo>)` and, after the
response is sent, posts a message in the order chat listing the proposals so
the client can answer; sales can then add the substitute with a phone order
(4.8, prefilled). *Deferred:* a one-tap approval button on the restaurant side
(restaurant area owned by another agent) — the chat message (per-order thread,
`partnership_messages.order_split_id`) is the record and the hook; the shared
`lib/orders/supplier-actions.ts` is left untouched.

### 4.4 Giro consegne — `/supplier/giro` (admin, warehouse, driver)

(Routes `/supplier/giro` and `/supplier/insight` live outside `/consegne` and
`/clienti` so the sidebar never highlights two entries at once.)

*UX.* For a date: stops grouped by delivery slot, each with client, address,
zone, value, status. "Ottimizza ordine" = nearest-neighbour from the
departure warehouse using restaurant/warehouse lat/lng; stops without
coordinates are appended grouped by zone → CAP → city. Planner (delivery.plan
or delivery.execute on own stops) can move stops up/down and save
(`deliveries.route_position`). Buttons: "Apri giro in Google Maps"
(`/maps/dir/?api=1&origin&destination&waypoints`, max 9 waypoints → split in
legs), per stop **Naviga** (Google Maps / Waze deep link), **Chiama**
(`tel:`), **Avvisa arrivo** (ETA in minutes → chat message on the order
thread + in-app/push notification to the restaurant), **Apri consegna** (POD
flow already built). Driver mode = big-touch mobile layout, own stops only.

### 4.5 Customer intelligence — `/supplier/insight` + client detail

*Per client (real orders, last 180 days, cancelled excluded):* orders count,
last order date, median days between orders (cadence, needs ≥3 orders),
expected next order, days late, revenue 90 d vs previous 90 d, open orders
value, status: *regolare* / *in ritardo* (late > 1.5× cadence) / *a rischio*
(late > 2.5× cadence or revenue −40 %) / *dormiente* (> 60 d) / *nuovo* (<3
orders). Sorted by risk × value. Client detail adds **prodotti persi**
(bought in ≥2 of the previous 90 d orders, not in the last 45 d) and
**suggeriti**: products bought by clients with the highest basket overlap
(Jaccard on product sets, ≥2 shared products) that this client never bought,
ranked by number of similar clients buying them. Permission:
`analytics.financial` (admin, sales).

### 4.6 Credit control (fido)

New table `supplier_customer_terms` (credit limit €, payment terms days,
credit hold flag, note). Exposure = value of open splits (confirmed →
shipping) + delivered splits within the payment term window (no invoicing
model yet — documented approximation, labelled "esposizione stimata").
Shown on client detail (editable with `pricing.edit`), insight list, order
detail and Oggi (chip "fido superato" / "bloccato"), and the phone order form
warns before creating. No hard block: the sales rep decides; a client on hold
gets a confirmation dialog.

### 4.7 Price lists at scale

* **Variazioni programmate**: on a listino, "Programma variazione" (% or €,
  all or a category, effective date ≥ tomorrow, notify clients). On creation
  clients assigned to the list get an in-app notification and a chat message
  "Dal <data> i prezzi di <categoria> varieranno del +3 %". Due changes are
  applied by `applyDueScheduledPriceChanges` — lazily when a member with
  `pricing.edit` opens Listini, and by `POST /api/cron/price-changes` (CRON_SECRET)
  for unattended runs. Cancel before the date.
* **Margini**: listino editor shows per item the weighted average cost per
  sales unit from active lots (`cost_per_base × conversion_to_base`) and the
  margin %; red under 10 %. Only for `analytics.financial`.

### 4.8 Ordine telefonico / WhatsApp — `/supplier/ordini/nuovo` (admin, sales)

*UX.* Pick an active client (search) → the form shows fido/exposure, the
client's **usual products** (last 90 d, with last qty) for one-tap add and
"Ripeti ultimo ordine"; product search over the catalog with the client's
listino price (assigned price list → default list → catalog price); paste
area "Incolla messaggio WhatsApp" with a deterministic line matcher
(`quantità + unità + nome` → best catalog match, all editable) exposed as
`parseOrderText()` so the `lib/ai/import` work can replace it; delivery date
(defaults to next zone delivery day honouring cut-off), notes, "Conferma
subito" (accepts all lines → stock reservation). Server: permission
`order.accept_line`, active relationship required, product ownership and
prices re-resolved server-side, order created through the same
`create_order_with_splits` RPC (service role, after authorisation), event
`received` with `source: supplier_phone_entry` + member id, restaurant notified
in-app.

## 5. Permissions (server-side)

| feature | permission |
|---|---|
| Oggi | member (`order.read`); sections filtered by role permissions |
| bulk accept, substitutions, phone order | `order.accept_line` |
| giro: view | `delivery.execute` or `delivery.plan`; reorder: same (driver only own) |
| ETA message | `delivery.execute` |
| insight, margins | `analytics.financial` |
| credit terms edit / scheduled prices | `pricing.edit` |

## 6. Migrations (additive, not applied)

`supabase/migrations/20261009000500_supplier_superpowers.sql`:
`deliveries.route_position`, `supplier_customer_terms`,
`scheduled_price_changes`, new `notification_event` values; RLS via
`is_supplier_member` / `has_supplier_permission`, policies created only when
missing (pg_policies check). All features degrade gracefully if the migration
is not yet applied (route order falls back to computed order, credit and
scheduled prices show a "migrazione mancante" notice).

## 7. Implementation status (2026-10-08)

| # | Feature | Where | Status |
|---|---|---|---|
| 1 | Oggi | `/supplier/oggi`, first nav item and first mobile tab; dashboard redirects warehouse/driver | done |
| 2 | Smart intake + bulk accept | Oggi "Da confermare", order detail per-line stock | done |
| 3 | Substitutions + partial fill | order detail ("Alternative disponibili", "Evadi parziale") | done (restaurant one-tap deferred) |
| 4 | Giro consegne | `/supplier/giro` (+ link from Consegne, Oggi) | done |
| 5 | Customer insight | `/supplier/insight`, client detail "Ritmo d'ordine" / "Da riproporre" | done |
| 6 | Credit control | client detail "Fido e pagamenti", Oggi, order detail, phone order | done (needs migration) |
| 7 | Scheduled prices + margins | listino detail; `POST /api/cron/price-changes` | done (scheduling needs migration) |
| 8 | Phone / WhatsApp order | `/supplier/ordini/nuovo` (+ Oggi, Ordini, client detail, order detail) | done |
| 9 | Reorder suggestions | Oggi "Magazzino" (warehouse/admin) | done |

Unit tests: `npm run test:supplier` (cadence, similar-client suggestions, route
planning, order-text parser).
