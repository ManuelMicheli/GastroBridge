# Restaurant superpowers — making GastroBridge the ristoratore's daily tool

Date: 2026-10-08 · Scope: restaurant area `app/(app)` (no supplier area, no import flows).
Design system: Fernly (`components/fernly/*`, `Modal`, `useConfirm`, accent tokens —
see `2026-10-07-fernly-style-redesign.md`). Team model: `lib/restaurants/context.ts`
+ `lib/restaurants/permissions.ts` (owner / manager / chef / viewer).

## 1. Who we design for

The Italian *ristoratore* / chef orders from 4–12 suppliers (ortofrutta, carni,
pesce, latticini, secco, bevande, detersivi) **every day**, usually:

* late at night after service (23:00–01:00) or very early (06:00–08:00), on a phone,
  with wet or gloved hands, standing in the walk-in;
* against hard supplier cut-offs ("entro le 18 per domani", "il pesce si ordina entro
  le 11"), often by WhatsApp / phone / voice memo — no history, no price memory;
* with a food cost under pressure: FIPE reports list prices up ~3% in 2025 and
  supplies up to +12% in city centres; the target food cost is 28–35% and above 40%
  the margin is gone. Price increases arrive silently on the next invoice;
* receiving goods in a rush at 7:30: missing crates, wrong weights or damaged
  goods are noticed late and credit notes are lost because nobody wrote them down
  with a photo while the driver was there.

What best-in-class tools do (Choco, MarketMan, WISK, Toast order guides, Supy):

| Pattern | Who does it | Takeaway for us |
|---|---|---|
| "Order guide" per supplier with usual items, delivery days and order deadlines | Toast, WISK | One screen per supplier, items pre-listed, cut-off visible |
| Par levels → suggested qty = par − on hand | WISK, MarketMan | Optional par per item, counted on the phone |
| 3-tap ordering, chat with supplier next to the order | Choco | Reorder must be one tap; disputes go in the existing chat |
| Irregular price report, alerts on supplier price increases | MarketMan | Price memory + alerts on items you actually buy |
| Receiving: flag shortage / damage per line, request credit at the dock | MarketMan, Supy (GRN vs credit note) | Check-in per line with photo, auto-message to supplier |

## 2. What GastroBridge already has (data reality)

| Area | Data available | Notes |
|---|---|---|
| Orders, marketplace | `orders`, `order_items` (+`products`), `order_splits` per supplier | Full line history: product id, qty, unit price |
| Orders, private catalogs | `orders.notes` text (`--- Supplier (€) ---` / `qty× name @ price`) | Parseable (`lib/analytics/notes-parser.ts`), matched to current catalog lines by normalized name |
| Catalogs | `products` (connected suppliers), `restaurant_catalogs` + `restaurant_catalog_items` (imported lists) | Catalog import replaces rows (delete + insert) → no price memory today |
| Marketplace price history | `price_history` (trigger on `products.price`) | Public read |
| Delivery rules, platform suppliers | `delivery_zones.delivery_days[]`, `cutoff_time`, `provinces`, `zip_codes` | Matched to the restaurant's province / CAP |
| Delivery rules, private catalogs | `restaurant_catalogs.delivery_days` (lead time only) | No weekdays, no cut-off → **missing** |
| Budget | `restaurants.monthly_budget_eur` | |
| POS | `fiscal_*` + `reorder_suggestions` (category-level, owner-only) | Already surfaced in Finanze → Ordini consigliati |
| Notifications | `in_app_notifications` (realtime toast + bell), `push_subscriptions` + web-push, `notification_event` enum | Dispatcher is supplier-oriented → add a restaurant fan-out helper |
| Chat | `partnership_messages` with `order_split_id` + URL attachments | Perfect channel for delivery disputes |
| Team | permissions `order.draft`, `order.submit`, `order.receive`, `par_levels.manage`, `issue.open` exist but are unused | |

Found while auditing: the dashboard computed `savings = spend × 8%` (fabricated, not
shown). Removed — savings are now only computed from real catalog prices.

## 3. Prioritized backlog (impact × effort)

Impact 1–5 (daily usefulness for a chef/owner), effort S/M/L. ✅ = built in this pass.

| # | Feature | Impact | Effort | Data exists? | Status |
|---|---|---|---|---|---|
| 1 | Riordino rapido (order guide per supplier, predicted qty, one-tap "come l'ultima volta", keypad) | 5 | M | Yes (history + catalogs) | ✅ |
| 2 | Cut-off & consegne (per-supplier delivery days + deadline countdown + reminders) | 5 | M | Partly (zones); new table for restaurant-defined schedules | ✅ |
| 3 | Ricevimento merce (check-in per line, photo, auto dispute message) | 5 | M | New tables + private bucket | ✅ |
| 4 | Osservatorio prezzi (price changes on what you buy, cheaper alternatives with normalized unit price, real potential savings) | 5 | M | Marketplace yes; catalogs need price memory (trigger) | ✅ |
| 5 | Ordine veloce (free-text / dictated shopping list → matched cart lines) | 4 | M | Yes | ✅ |
| 6 | Lista cucina condivisa (chef adds needs, who can order approves → cart) | 4 | M | New table | ✅ |
| 7 | Scorte minime (par levels) integrated in Riordino | 4 | S | New table | ✅ |
| 8 | Dashboard "Oggi in cucina" (cut-offs, deliveries to check in, kitchen list, price alerts) | 4 | S | Yes | ✅ |
| 9 | Reminders + weekly digest via in-app + web push (cron route) | 4 | S | Yes | ✅ |
| 10 | Supplier reliability score (on-time, completeness from check-ins) | 3 | S | After #3 collects data | Deferred (needs weeks of check-ins) |
| 11 | AI parsing of messy lists / voice memos / photos of handwritten lists | 4 | M | — | Deferred: TODO hook in `lib/restaurants/quick-order/parse.ts` (owned by the `lib/ai/import` agent) |
| 12 | POS-driven quantities per product (recipes / BOM) | 4 | L | POS is category-level only | Deferred: needs recipe mapping |
| 13 | Recurring orders (auto-send every Tue) | 3 | M | `recurring.manage` exists | Deferred: risky without supplier confirmation UX |
| 14 | Invoice (fattura elettronica) three-way match | 4 | L | No invoice data | Deferred |

## 4. Feature specs

### 4.1 Riordino rapido — `/riordina`

*Problem*: every evening the chef rebuilds the same 30-line order per supplier from
memory or WhatsApp history.

*UX* (mobile-first, kitchen-friendly): one card per supplier, sorted by the nearest
order deadline. Header: supplier, cut-off chip ("entro 18:00 · 2h 14m"), next
delivery, minimum order progress. Lines: product, unit, current price, "di solito
ogni ~N giorni · ultimo N gg fa", a "da riordinare" badge when overdue, and a big
stepper (−/qty/+, 44 px targets); tapping the qty opens a numeric keypad sheet.
Per supplier: **Come l'ultima volta** (last order's quantities), **Suggeriti**
(prediction), **Svuota**, **Aggiungi al carrello** (lines go to the existing cart
split per supplier). Toggle **Conta scorte** shows *in magazzino* + *scorta minima*
per line; suggested = max(0, par − on hand).

*Prediction* (explainable, no fabricated numbers): median quantity of the last 5
orders of the item; due when days since last order ≥ median interval between orders
− 1. With a par level and a count, par − on hand wins. Items only appear if they are
still orderable (current offer exists); otherwise they are listed as "non più a
listino".

*Data*: marketplace `order_items` (180 days) + catalog orders parsed from notes and
matched to current catalog lines by normalized name; `restaurant_par_levels` (new).

### 4.2 Consegne & cut-off — `/consegne`

*Problem*: missed cut-offs = no fish tomorrow.

*UX*: list of suppliers with delivery weekdays, cut-off time, lead days, source
("dal fornitore" for platform zones / "impostato da te"); next deadline countdown and
next delivery date; edit modal (weekday chips, time, lead days, reminder toggle).
Also a 7-day strip of expected deliveries (`order_splits.expected_delivery_date`)
and cut-offs.

*Rule*: delivery on day X is possible if ordered before `cutoff_time` on
`X − lead_days`. Times are Europe/Rome.

*Data*: `delivery_zones` matched by restaurant province/CAP (read-only); new
`restaurant_supplier_schedules` (per platform supplier or private catalog) that
overrides it.

*Reminders*: `/api/restaurant/reminders` (cron, every 30 min) notifies members with
`order.submit` (in-app + web push) when a deadline falls in the next 2 hours and no
order was sent to that supplier since the previous deadline. Deduplicated in
`restaurant_notification_log`.

### 4.3 Ricevimento merce — order detail → "Ricevi merce"

*Problem*: shortages/damages discovered too late, credit notes lost.

*UX*: full-screen check-in list for the order (marketplace lines or parsed catalog
lines). Per line: ✓ OK by default, or flag **Mancante / Quantità diversa /
Danneggiato / Prodotto errato / Qualità** with received qty, note and photo (camera
capture, client-side compressed). "Tutto ok" one-tap. Submit → saved check, order
page shows the result; if issues and the supplier is on the platform, a message with
the list + photos is posted in the order thread of the supplier chat.
Catalog-only orders are marked `delivered` (the restaurant owns those);
marketplace split statuses stay with the supplier workflow (POD/DDT).

*Permissions*: `order.receive` (owner, manager, chef). *Data*: new `delivery_checks`,
`delivery_check_lines`, private bucket `delivery-checks`.

### 4.4 Osservatorio prezzi — `/prezzi`

*UX*: three sections.
1. **Variazioni** (last 30 days) on items bought in the last 90 days: old → new,
   %, and monthly impact = Δ × average monthly quantity bought.
2. **Alternative più convenienti**: for each bought item, offers from *other*
   suppliers with the same product (token match) and a comparable normalized unit
   price (€/kg, €/l, €/pz parsed from unit + pack size in the name, e.g.
   "125g x 8", "latta 5 l"). Shows saving per unit and estimated monthly saving;
   "Aggiungi al carrello".
3. **Risparmio potenziale al mese** = Σ estimated monthly savings (real prices × real
   volumes). Nothing is shown when there is no comparable data.

*Data*: `price_history` (marketplace) + new `restaurant_catalog_price_changes` filled
by a trigger on `restaurant_catalog_items` (import-agnostic: works with
delete+insert re-imports because the memory is keyed by catalog + normalized name +
unit). Daily in-app notification of increases on items you buy (reminders cron).

### 4.5 Ordine veloce — `/ordine-veloce` (+ ⌘K)

*Problem*: "2 kg datterini, 1 cassa limoni, 3 mozzarelle" typed or dictated at 1am.

*UX*: textarea (one line or comma-separated), dictation button (Web Speech API,
it-IT, when available), live parsed preview: each line → best match (supplier you
last bought it from, else best price) with alternatives dropdown, qty stepper,
unmatched lines highlighted. "Aggiungi al carrello". From the command palette, typing
a line that starts with a quantity offers "Ordine veloce: …".

*Parsing*: deterministic (quantities incl. "mezzo", "un", "1,5", units/pack words,
"x6"), matching by token overlap on normalized names with Italian plural folding.
AI parsing left as a TODO hook (coordinated with the `lib/ai/import` owner).

### 4.6 Lista cucina — `/lista-cucina`

*Problem*: the chef writes needs on a whiteboard; the owner orders the next morning.

*UX*: shared list. Anyone with `order.draft` adds items (free text, parsed and matched
like 4.5). Members with `order.submit` see "Approva → carrello" (bulk), "Rifiuta";
the requester can delete their open items. When an item is added, members who can
order get an in-app + push notification. Status: aperta → nel carrello / rifiutata.

*Data*: new `kitchen_requests`.

### 4.7 Dashboard — "Oggi in cucina"

Card at the top of the dashboard: next 3 cut-offs with countdown, deliveries expected
today/tomorrow with "Ricevi merce", open kitchen-list items, price increases this
week, items due for reorder. All links into 4.1–4.6.

### 4.8 Digest settimanale

`/api/restaurant/reminders?job=digest` (Monday morning): spend last week vs the
previous one, month-to-date vs budget, price increases, delivery issues → in-app +
push to owners/managers (`analytics.financial`).

## 5. Data model (additive migrations)

* `20261009000000_restaurant_superpowers_enums.sql` — `notification_event` +=
  `order_cutoff_reminder`, `price_change`, `kitchen_request`, `delivery_issue`,
  `restaurant_digest`.
* `20261009000100_restaurant_superpowers.sql` — tables
  `restaurant_supplier_schedules`, `restaurant_par_levels`,
  `restaurant_catalog_price_memory`, `restaurant_catalog_price_changes` (+ trigger +
  backfill), `kitchen_requests`, `delivery_checks`, `delivery_check_lines`,
  `restaurant_notification_log`; private bucket `delivery-checks`; RLS for owners and
  team members via `private.is_restaurant_member` / `private.has_restaurant_permission`
  (policies created in `DO` blocks guarded by `pg_policies`, no `DROP`).

## 6. Sources

* [Toast — restaurant order guide](https://pos.toasttab.com/vi-us/blog/on-the-line/restaurant-order-guide-template)
* [WISK — par inventory sheet](https://www.wisk.ai/blms/par-inventory-sheet)
* [Supy — credit note vs GRN](https://supy.io/blog/learn-credit-note-vs-grn-supplier-discrepancy-guide)
* [MarketMan — irregular price report / vendor payments](https://www.marketman.com/platform/restaurant-vendor-payments-seamlessly-pay-your-restaurant-vendor-bills-online)
* [Choco — restaurants](https://choco.com/restaurants)
* [Affaritaliani — ristorazione romana, listini in aumento (FIPE 2026)](https://www.affaritaliani.it/roma/ristorazione-romana-sotto-pressione-listini-verso-lalto-da-settembre.html)
* [Qamarero — food cost guida 2025](https://www.qamarero.com/it/blog/food-cost-tabella-e-guida-completa/)
* [FoodStorm — smart cut-offs](https://www.foodstorm.com/blog/smart-cut-offs)
