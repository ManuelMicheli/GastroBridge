# Cassetto Fiscale — Design Spec

**Date:** 2026-04-20
**Status:** Draft, awaiting user review
**Owner:** Manuel Micheli
**Area:** Restaurant (area ristoratore) — nuova sezione `/finanze`

---

## 1. Goal

Collegare la piattaforma GastroBridge ai dati di vendita (scontrini) del ristorante per:

1. Misurare **food cost %** reale = `acquisti materia prima GB ÷ incasso POS` (giornaliero / settimanale / mensile / per sede).
2. Confrontare **ordini vs incasso** (trend, gap, stagionalità).
3. Generare **alert "scorta in esaurimento"** e una vista **"ordine consigliato"** basata su depletion reale (acquisti meno vendite stimate + cadenza storica).
4. Fornire analytics fiscali: scontrino-level, item-level, breakdown per categoria, sede, operatore, metodo pagamento.
5. Preparare l'aggancio futuro al **Cassetto Fiscale Agenzia Entrate** (fatture elettroniche + corrispettivi telematici) senza refactor.

La feature è dedicata all'**area ristoratore**. Nessun impatto lato fornitore (almeno in questa iterazione).

---

## 2. Scope

### In scope (MVP)
- Integrazione diretta API di 4 POS (Tier 1): **Tilby**, **Cassa in Cloud**, **Lightspeed Restaurant**, **Scloby**.
- Webhook endpoint generico per POS con push events.
- Upload manuale CSV/XML (fallback universale, qualsiasi POS).
- Normalizzazione dati scontrini in schema unificato.
- Dashboard food cost + sezione `/finanze` (lista scontrini, dettaglio, analytics, alert).
- Reorder engine con "ordine consigliato" (vista + notifica).
- Multi-sede (un ristorante può collegare più POS, uno per sede).

### Fast-follow (Tier 2, after MVP ships)
- **TCPOS**, **Revo**, **Oracle Simphony**, **HIOPOS**.

### Later (Tier 3)
- GP Dati, iPratico, altri POS minori.
- Integrazione Cassetto Fiscale AdE (richiede delega SPID/CIE, OAuth con SDI, scraping del portale — fattibile ma separato).

### Out of scope
- Ricettario / BOM piatto↔ingredienti (deferred: richiederebbe modellazione dedicata).
- Emissione scontrini (GastroBridge non diventa un RT).
- Gestione corrispettivi da inviare ad AdE (resta al POS).
- Contabilità piena (P&L, IVA liquidazioni) — demandata a commercialista.

---

## 3. Architectural approach — Hybrid

```
┌─────────────────────────────────────────────────────────────┐
│                    POS providers                             │
│  Tilby · Cassa in Cloud · Lightspeed · Scloby · CSV · ...   │
└───────────┬──────────────────────────────┬──────────────────┘
            │ webhook push                 │ scheduled pull
            ▼                              ▼
  ┌──────────────────────┐    ┌────────────────────────────┐
  │ Next.js route        │    │ Supabase Edge Function     │
  │ /api/fiscal/webhooks │    │ fiscal-sync (Deno)         │
  │ /[provider]          │    │ triggered by pg_cron 2h    │
  │                      │    │                            │
  │ verify signature     │    │ for each integration:      │
  │ → insert raw         │    │   adapter.fetchSince(ts)   │
  │ → enqueue process    │    │   → insert raw             │
  └──────────┬───────────┘    └──────────┬─────────────────┘
             │                           │
             └───────────┬───────────────┘
                         ▼
         ┌───────────────────────────────┐
         │ Postgres: fiscal_raw_events   │
         │ (source of truth, append-only)│
         └───────────────┬───────────────┘
                         │ trigger
                         ▼
         ┌───────────────────────────────┐
         │ Normalization fn (PL/pgSQL)   │
         │ → fiscal_receipts             │
         │ → fiscal_receipt_items        │
         │ → fiscal_daily_summary (MV)   │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Reorder engine                │
         │ (materialized views + RPC)    │
         │ → reorder_suggestions         │
         │ → in_app_notifications        │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Next.js UI: /finanze/*        │
         │ (Server Components + TanStack)│
         └───────────────────────────────┘
```

### Rationale
- **Webhooks in Next.js route handlers**: latency bassa, verifica firma HMAC, riuso del project secret store (env vars Vercel), accesso al Supabase service-role client già presente (`lib/supabase/admin.ts`).
- **Scheduled pull in Supabase Edge Functions**: gira fuori dal runtime HTTP, timeout generoso, triggerabile da `pg_cron` in-DB. Ricovero gap eventualmente persi dal webhook.
- **Adapter condivisi** in `lib/fiscal/adapters/` come moduli TS che compilano sia per Node (Next.js) che per Deno (Edge Functions via `deno.json` import map). Una sola implementazione per provider.
- **Normalizzazione in Postgres**: trigger + funzioni PL/pgSQL. Zero doppie scritture, idempotente per `(provider, external_id)`.
- **Reorder engine in MV**: rapido da leggere per la UI, refresh incrementale on write.

### Perché non approach 1 (full Edge) o approach 2 (only Next.js)?
- Full Edge costringe a riscrivere SDK Node-only e complica debug locale.
- Only Next.js sovraccarica le route Vercel con sync batch e soffre del limite free-tier cron. Inoltre esegue sync nel runtime HTTP.

---

## 4. Data model

> **Nota modello sedi (multi-location):** in GastroBridge ogni **sede è una riga in `restaurants`** (stesso `profile_id` per il proprietario, `is_primary` segna la sede principale). Non esiste una tabella `restaurant_locations` separata. Tutto il modello fiscale usa `restaurant_id` per collegare dati alla sede, e il "gruppo proprietà" si ottiene via `profile_id`. Vedi §4.8 per helper di aggregazione cross-sede.

### 4.1 Integrazione POS (configurazione)
```sql
CREATE TYPE fiscal_provider AS ENUM (
  'tilby','cassa_in_cloud','lightspeed','scloby',
  'tcpos','revo','simphony','hiopos',
  'generic_webhook','csv_upload'
);

CREATE TYPE fiscal_integration_status AS ENUM (
  'pending_auth','active','paused','error','revoked'
);

CREATE TABLE fiscal_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider fiscal_provider NOT NULL,
  status fiscal_integration_status NOT NULL DEFAULT 'pending_auth',
  display_name TEXT,              -- "Cassa sala principale"
  credentials JSONB,              -- cifrato (vedi §10 security), access_token/refresh_token/api_key
  config JSONB NOT NULL DEFAULT '{}', -- provider-specific (shop_id, device_id, tz, ...)
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  webhook_secret TEXT,            -- HMAC shared secret (generic_webhook)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, provider)
);
CREATE INDEX ON fiscal_integrations(restaurant_id);
CREATE INDEX ON fiscal_integrations(status) WHERE status IN ('active','error');
```

> Se un ristoratore ha più casse dello stesso POS nella stessa sede (es. 2 casse Tilby), le registra come integrazioni distinte via `display_name` + `config.device_id`. Rimuoviamo il constraint `UNIQUE(restaurant_id, provider)` in favore di `UNIQUE(restaurant_id, provider, (config->>'device_id'))` via expression index se serve.

### 4.2 Raw events (append-only)
```sql
CREATE TABLE fiscal_raw_events (
  id BIGSERIAL PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,      -- id scontrino dal POS
  event_type TEXT NOT NULL,       -- receipt.created | receipt.voided | ...
  payload JSONB NOT NULL,         -- raw payload originale
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  process_error TEXT,
  UNIQUE(integration_id, external_id, event_type)
);
CREATE INDEX ON fiscal_raw_events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX ON fiscal_raw_events(integration_id, received_at DESC);
```

### 4.3 Normalized receipts
```sql
CREATE TYPE fiscal_receipt_status AS ENUM ('issued','voided','refunded','partial_refund');

CREATE TABLE fiscal_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES fiscal_integrations(id),
  external_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  business_day DATE NOT NULL,     -- giornata fiscale (chiusura cassa)
  status fiscal_receipt_status NOT NULL DEFAULT 'issued',
  subtotal_cents INT NOT NULL,    -- soldi in cents per evitare float
  vat_cents INT NOT NULL,
  total_cents INT NOT NULL,
  payment_method TEXT,            -- cash|card|meal_voucher|other
  operator_name TEXT,
  table_ref TEXT,                 -- numero tavolo se disponibile
  covers INT,                     -- coperti
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, external_id)
);
CREATE INDEX ON fiscal_receipts(restaurant_id, business_day DESC);

CREATE TABLE fiscal_receipt_items (
  id BIGSERIAL PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES fiscal_receipts(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  pos_item_id TEXT,               -- id prodotto nel POS
  name TEXT NOT NULL,
  category TEXT,                  -- categoria dichiarata dal POS (es. "Primi")
  quantity DECIMAL(10,3) NOT NULL,
  unit_price_cents INT NOT NULL,
  subtotal_cents INT NOT NULL,
  vat_rate DECIMAL(5,2),
  discount_cents INT DEFAULT 0,
  is_voided BOOLEAN DEFAULT FALSE
);
CREATE INDEX ON fiscal_receipt_items(receipt_id);
CREATE INDEX ON fiscal_receipt_items(pos_item_id);
```

### 4.4 POS item catalog (per mapping soft)
```sql
CREATE TABLE fiscal_pos_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  pos_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_sold_cents BIGINT DEFAULT 0,
  total_qty DECIMAL(12,3) DEFAULT 0,
  UNIQUE(integration_id, pos_item_id)
);

-- Mapping soft: un POS item può linkare ad un prodotto GB o a una categoria merceologica
CREATE TABLE fiscal_pos_item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_item_id UUID NOT NULL REFERENCES fiscal_pos_items(id) ON DELETE CASCADE,
  gb_product_id UUID REFERENCES products(id),     -- per prodotti diretti (birra, vino)
  gb_category_id UUID REFERENCES categories(id),  -- per piatti (via categoria merce)
  depletion_ratio DECIMAL(5,2) DEFAULT 1.0,       -- es. 0.15 = il 15% del prezzo venduto pesa sulla categoria
  source TEXT NOT NULL DEFAULT 'user',            -- user|auto_heuristic|ml
  confidence DECIMAL(3,2),                        -- 0..1 se auto
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (gb_product_id IS NOT NULL OR gb_category_id IS NOT NULL)
);
CREATE UNIQUE INDEX ON fiscal_pos_item_mappings(pos_item_id)
  WHERE gb_product_id IS NOT NULL;
```

### 4.5 Aggregati (materialized views)
```sql
-- daily per sede (una sede = una riga restaurants)
CREATE MATERIALIZED VIEW fiscal_daily_summary AS
SELECT
  restaurant_id,
  business_day,
  COUNT(*) FILTER (WHERE status = 'issued') AS receipts_count,
  SUM(total_cents) FILTER (WHERE status = 'issued') AS revenue_cents,
  SUM(vat_cents) FILTER (WHERE status = 'issued') AS vat_cents,
  SUM(covers) FILTER (WHERE status = 'issued') AS covers,
  AVG(total_cents) FILTER (WHERE status = 'issued') AS avg_ticket_cents
FROM fiscal_receipts
GROUP BY restaurant_id, business_day;
CREATE UNIQUE INDEX ON fiscal_daily_summary(restaurant_id, business_day);

-- food cost: incrocia fiscal_daily_summary con spend da orders/order_items
CREATE MATERIALIZED VIEW fiscal_food_cost AS
SELECT
  r.id AS restaurant_id,
  d.business_day,
  d.revenue_cents,
  COALESCE(s.spend_cents, 0) AS spend_cents,
  CASE WHEN d.revenue_cents > 0
    THEN ROUND(100.0 * s.spend_cents / d.revenue_cents, 2)
    ELSE NULL END AS food_cost_pct
FROM fiscal_daily_summary d
JOIN restaurants r ON r.id = d.restaurant_id
LEFT JOIN LATERAL (
  SELECT SUM(ROUND(oi.subtotal * 100))::BIGINT AS spend_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = r.id
    AND o.status IN ('delivered','shipping')
    AND DATE(o.created_at) = d.business_day
) s ON TRUE;
```

### 4.6 Reorder
```sql
CREATE TYPE reorder_urgency AS ENUM ('low','medium','high','critical');

CREATE TABLE reorder_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES categories(id),
  suggested_qty DECIMAL(10,2),
  suggested_unit TEXT,
  estimated_coverage_days INT,       -- quanti giorni copre la scorta stimata
  urgency reorder_urgency NOT NULL,
  reason TEXT NOT NULL,              -- "Trend vendite ultimi 7gg: 2.3kg/giorno; scorta stimata 4gg"
  preferred_supplier_id UUID REFERENCES suppliers(id),
  snapshot JSONB NOT NULL,           -- input usati per audit
  state TEXT NOT NULL DEFAULT 'open',-- open|acted|dismissed|expired
  acted_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 days',
  CHECK (product_id IS NOT NULL OR category_id IS NOT NULL)
);
CREATE INDEX ON reorder_suggestions(restaurant_id, state, urgency)
  WHERE state = 'open';
```

### 4.7 RLS policies (sintesi)
Il modello attuale è **owner-based**: `restaurants.profile_id = auth.uid()` è l'unico criterio di membership. Niente tabella `restaurant_members` (team è Business-tier placeholder). Quindi:
- `fiscal_integrations`: `SELECT/INSERT/UPDATE/DELETE` ammesso se `restaurants.profile_id = auth.uid()` per `restaurant_id`.
- `fiscal_raw_events`: nessuna policy user — scritture solo via service role (edge fn + webhook). Lettura admin-only via view.
- `fiscal_receipts`, `fiscal_receipt_items`, `fiscal_pos_items`, `fiscal_pos_item_mappings`, `reorder_suggestions`: `SELECT` ammesso se owner del ristorante; scritture solo service role.
- Helper SECURITY DEFINER `fiscal_owns_restaurant(restaurant_id UUID)` → BOOLEAN per evitare ricorsione RLS (vedi `feedback_rls_recursion.md`).
- Quando in futuro sarà introdotto `restaurant_members`, si estende l'helper senza toccare le policy.

### 4.8 Helper cross-sede
Un "gruppo proprietà" è l'insieme di `restaurants` con stesso `profile_id`. View comoda:
```sql
CREATE VIEW fiscal_owner_summary AS
SELECT
  r.profile_id,
  SUM(d.revenue_cents) AS revenue_cents,
  SUM(d.receipts_count) AS receipts_count,
  d.business_day
FROM fiscal_daily_summary d
JOIN restaurants r ON r.id = d.restaurant_id
GROUP BY r.profile_id, d.business_day;
```
UI che mostra "tutte le sedi" aggrega su questa view; UI per singola sede filtra `restaurant_id`.

---

## 5. POS adapter interface

Tutti gli adapter implementano la stessa interfaccia in `lib/fiscal/adapters/types.ts`:

```ts
export interface PosAdapter {
  readonly provider: FiscalProvider;

  // OAuth2 / API-key bootstrap
  getAuthUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<Credentials>;
  refreshCredentials?(creds: Credentials): Promise<Credentials>;

  // Data fetch
  fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    since: Date,
    until?: Date,
  ): AsyncIterable<RawReceipt>;

  fetchCatalog?(
    creds: Credentials,
    config: ProviderConfig,
  ): AsyncIterable<RawPosItem>;

  // Webhook support (optional)
  verifyWebhook?(
    headers: Record<string,string>,
    body: string,
    secret: string,
  ): boolean;
  parseWebhook?(body: string): RawReceiptEvent[];

  // Normalization — pure fn, no I/O
  normalize(raw: RawReceipt, integration: FiscalIntegration): NormalizedReceipt;
}
```

Ogni adapter vive in `lib/fiscal/adapters/<provider>/`:
- `index.ts` — implementazione
- `types.ts` — schema zod del payload raw specifico del provider
- `fixtures/` — sample responses per test

Adapter Tier 1:
| Provider | Auth | Webhook | Pull | Note |
|----------|------|---------|------|------|
| Tilby | OAuth2 | ✓ | ✓ | Zucchetti API, endpoint `/api/v1/receipts` |
| Cassa in Cloud | API key + shop_id | — | ✓ | TeamSystem, pull only |
| Lightspeed Restaurant | OAuth2 | ✓ | ✓ | K-Series & L-Series diversi — scegliere K per MVP |
| Scloby | API key | ✓ | ✓ | Zucchetti, webhook "receipts" |
| generic_webhook | HMAC shared secret | ✓ | — | per POS custom |
| csv_upload | — | — | — | parsing lato Next.js, schema mapping guidato |

---

## 6. Sync flows

### 6.1 Webhook (push)
```
POS → POST /api/fiscal/webhooks/[provider]
     headers: x-gb-integration-id, x-<provider>-signature
     body: raw JSON

Next.js route:
  1. load integration by id
  2. adapter.verifyWebhook(headers, body, integration.webhook_secret)
  3. events = adapter.parseWebhook(body)
  4. INSERT INTO fiscal_raw_events (one row per event)
  5. return 200
Postgres trigger on insert:
  → ingest_raw_event(NEW.id)
    which calls adapter.normalize via LISTEN/NOTIFY
    (OR batch normalize in edge fn, see §6.3)
```

### 6.2 Scheduled pull
```
pg_cron job every 2h:
  SELECT net.http_post(
    url := 'https://<proj>.functions.supabase.co/fiscal-sync',
    headers := jsonb_build_object('Authorization', ...)
  );

Edge fn fiscal-sync (Deno):
  for each integration where status='active':
    since = integration.last_synced_at ?? (now - 48h)
    for await raw in adapter.fetchReceipts(creds, config, since):
      upsert fiscal_raw_events
    update integration.last_synced_at = now
    on error: update integration.status='error', last_error=msg
```

### 6.3 Normalization
Processamento raw → normalized via Postgres function invocata da:
- trigger `AFTER INSERT ON fiscal_raw_events` (live)
- edge fn fallback che legge `WHERE processed_at IS NULL` (gap recovery)

```sql
CREATE FUNCTION process_fiscal_raw_event(evt_id BIGINT) RETURNS VOID ...
```

Funzione:
1. Carica `payload`, `integration.provider`.
2. Dispatcha al normalizer SQL del provider (una per provider, in `supabase/functions/sql/normalizers/<provider>.sql`).
3. UPSERT `fiscal_receipts` + `fiscal_receipt_items` + `fiscal_pos_items`.
4. `REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_daily_summary` (debounced, max 1/min).
5. Imposta `processed_at` o `process_error`.

### 6.4 CSV upload
UI `/finanze/import` → Next.js server action:
1. Parse file (Papaparse o xlsx).
2. User pilota mapping colonne → schema (data, totale, items…).
3. Scrittura come `fiscal_raw_events` con `provider='csv_upload'`.
4. Stesso flusso di normalizzazione.

Persistiamo il mapping in `integration.config.csv_mapping` per riusarlo.

---

## 7. Reorder engine

### 7.1 Segnali di input
1. **Acquisti per categoria/prodotto** (da `orders` + `order_items`, ultimi 90gg).
2. **Vendite per POS item** (da `fiscal_receipt_items`, ultimi 30gg).
3. **Mapping POS item → GB product / category** (`fiscal_pos_item_mappings`).
4. **Cadenza storica**: intervallo medio e deviazione standard tra ordini dello stesso prodotto/categoria.
5. **Scorta stimata** per categoria/prodotto (vedi 7.2).

### 7.2 Depletion model (senza BOM)
Per ogni categoria merceologica (es. "carne bovina"):

```
spend_in_window   = Σ subtotali ordini (delivered) nel window
sales_weighted    = Σ (receipt_item.subtotal × mapping.depletion_ratio)
                    per tutti i POS items mappati sulla categoria
estimated_remaining_cents = spend_in_window − sales_weighted
daily_depletion_rate      = sales_weighted / window_days
coverage_days     = estimated_remaining_cents / daily_depletion_rate
```

Per prodotti diretti mappati 1:1 (birra, vino, bibite in confezioni fisse):
- Si usa qty, non cents.
- `qty_remaining = qty_bought − qty_sold`.

### 7.3 Regole di trigger
Suggerimento aperto quando **una** di queste condizioni è vera:
- `coverage_days ≤ 3` → urgency `critical`.
- `coverage_days ≤ 7` → urgency `high`.
- `days_since_last_order ≥ avg_reorder_interval × 0.9` → urgency `medium` (segnale cadenza).
- Trigger ML-light futuro (vedi §13).

### 7.4 Generazione suggerimento
`generate_reorder_suggestions()` gira:
- Edge fn `fiscal-reorder` triggerata da pg_cron ogni notte (02:00) + ad-hoc dopo normalizzazione receipts batch.
- Per ogni categoria/prodotto sopra soglia:
  1. Suggerisce qty = `avg_qty_per_order × 1.1`.
  2. Suggerisce fornitore: `preferred_supplier_id` da `restaurant_suppliers` oppure top-1 per frequenza.
  3. INSERT in `reorder_suggestions` se non esiste già uno `state='open'` per la stessa chiave.
  4. Crea `in_app_notification` (tabella esistente).

### 7.5 Deduplica / cooldown
- Un solo suggerimento `open` per `(restaurant_id, product_id or category_id)`.
- Se utente fa `dismiss`, cooldown di 48h prima di rigenerare.
- Se utente fa `acted_order`, link all'order → suggestion `acted`.

---

## 8. UI / UX

### Routing area ristoratore (`app/(app)/finanze/`)
```
/finanze                   → dashboard: food cost %, trend, ordini vs incasso
/finanze/scontrini         → lista scontrini (filtri: data, sede, operatore, metodo)
/finanze/scontrini/[id]    → dettaglio scontrino item-level
/finanze/analytics         → breakdown per categoria, sede, orari, benchmark
/finanze/ordini-consigliati → lista reorder suggestions con CTA "ordina ora"
/finanze/alert             → storico alert (food cost > soglia, anomalie)
/finanze/integrazioni      → settings POS (connetti, pause, reauth, CSV upload)
/finanze/integrazioni/csv  → upload + mapping wizard
```

Link nella sidebar ristoratore (già presente `components/dashboard/sidebar.tsx`): nuova voce "Finanze" con icona `Euro` o `Receipt`.

### Dashboard `/finanze` (principale)
- KPI cards: Food Cost % (vs scorso mese), Incasso mese, Acquisti mese, Margine lordo stimato, Scontrini emessi, Ticket medio.
- Line chart: ordini vs incasso (90gg), dual axis.
- Donut: breakdown acquisti per categoria.
- Lista top 5 "ordini consigliati" con urgency badge.
- Alert banner se food cost > target (settabile in impostazioni).

Design: riuso `DarkCard`, KPI sparklines, chart SVG custom (pattern esistente).

### `/finanze/ordini-consigliati`
- Tabella: categoria/prodotto · qty suggerita · copertura · urgenza · fornitore suggerito · CTA
- CTA "Ordina ora" precompila `/carrello` con items suggeriti, usando il fornitore preferito.
- Swipe actions mobile: dismiss / snooze 24h.

### Notifiche
- In-app: riuso tabella `in_app_notifications`, tipologia nuova `reorder_suggested`, link a `/finanze/ordini-consigliati`.
- Push (se abilitate): payload con urgency.
- Email digest giornaliero opzionale (future).

### Integrazioni / setup flow
1. Scegli provider da list.
2. OAuth redirect (o input API key).
3. Scegli sede(i) da associare.
4. Scegli se abilitare webhook (se supportato).
5. Fetch storica (ultimi 30gg) per bootstrap.
6. Confirm.

Wizard in `/finanze/integrazioni/nuova/[provider]/page.tsx`.

---

## 9. CSV import format

Schema normalizzato atteso (per riga = item):

| Colonna | Obbligatorio | Note |
|---------|:-:|------|
| receipt_external_id | ✓ | id scontrino |
| issued_at | ✓ | ISO datetime |
| business_day | | default = date(issued_at) |
| (sede) | | MVP: la sede è scelta dall'utente nel wizard. Multi-sede in un solo file è deferred (richiederebbe colonna `restaurants.pos_external_id`). |
| line_number | ✓ | |
| item_name | ✓ | |
| category | | |
| quantity | ✓ | |
| unit_price | ✓ | in € (convertito a cents) |
| vat_rate | | default 10% se null |
| discount | | |
| payment_method | | solo sulla prima riga |
| total | | solo sulla prima riga, validato vs somma |
| operator | | |
| covers | | |

Wizard supporta mapping da schemi alternativi (es. Lightspeed export) in `lib/fiscal/csv-schemas/`.

---

## 10. Security

### Secrets
- OAuth client_id/client_secret per provider in Vercel env vars (`POS_TILBY_CLIENT_ID`, ...).
- Credentials per integrazione salvate in `fiscal_integrations.credentials` **cifrate** con `pgsodium` (symmetric, key in Supabase Vault).
- Helper `fiscal_decrypt_credentials(integration_id)` SECURITY DEFINER ristretta a role `service_role` + a funzioni di adapter.

### Webhook verification
- Ogni adapter implementa HMAC/signature check conforme al provider.
- `generic_webhook` → HMAC-SHA256 con `webhook_secret` generato per integrazione.
- Rate limit 100 req/min per integration_id (Vercel Edge middleware).
- Idempotency via `UNIQUE(integration_id, external_id, event_type)`.

### RLS
- No utente finale legge `fiscal_integrations.credentials` direttamente (column-level via view `fiscal_integrations_safe`).
- Policy per `fiscal_receipts.*` controlla membership via helper SECURITY DEFINER.

### PII
- `operator_name` oscurato se ristoratore non ha consenso (GDPR employee data): configurabile.
- Retention: 24 mesi default, extendable a 10 anni (obbligo fiscale) via setting.

---

## 11. Observability

- Log sync su `fiscal_sync_logs(integration_id, started_at, ended_at, fetched, inserted, errors)`.
- Edge fn emette metriche a Supabase `analytics` schema via `pg_stat_statements` query.
- Sentry (esistente?) wrap degli adapter.
- Admin-only endpoint `/api/fiscal/health` per status di tutte le integrazioni.
- Alert interno se sync fallisce 3 volte consecutive.

---

## 12. Rollout

1. **Feature flag**: `fiscal_enabled` in `restaurant_preferences` — default off.
2. **Beta**: abilitata su 3-5 ristoranti pilota con POS Tilby/Cassa in Cloud.
3. **Seed data**: utility per importare ultimi 90gg al primo collegamento.
4. **GA**: toggle default on, annuncio in-app.

---

## 13. Out of scope / future

- **AdE Cassetto Fiscale**: modulo `fiscal_ae` separato, auth SPID/CIE delegata, parsing fatture XML, corrispettivi XML. Stessa shape adapter (`provider='ade'`).
- **Ricettario / BOM**: tabelle `recipes`, `recipe_ingredients`, con `dish_id` ↔ ingredienti GB. Abilita food cost per piatto reale.
- **Cash flow forecast**: combinare scheduled orders + historical receipts per prevedere margine 30gg.
- **ML reorder**: Prophet/ARIMA su time series item-level.
- **Benchmark**: confronto food cost anonymizzato vs coorte ristoranti simili (richiede onboarding dati sufficiente).
- **Emissione DDT automatico** per ristoratori che rivendono (catering).

---

## 14. Open questions (da confermare prima di plan)

1. **Target food cost** — soglia di alert di default (industry: 28-32% per ristoranti)? Configurabile per categoria?
2. **Timezone** — assumiamo Europe/Rome globale o supportiamo multi-timezone per chain nazionali?
3. **Retention policy** — 24 mesi ok come default? 10 anni su richiesta?
4. **OAuth redirect URI** — confermare dominio produzione + staging.
5. **PWA notifiche push** — già configurate nel progetto (`lib/push`)? Usiamo quella infra?
6. **Budget LLM per auto-mapping POS items → categorie** — usare Claude Haiku per suggerire mapping al primo import?

---

## 15. Acceptance criteria

- [ ] Ristoratore può collegare almeno 1 POS Tier 1 via OAuth o API key.
- [ ] Scontrini arrivano in DB entro 5 min dall'emissione (via webhook).
- [ ] Dashboard mostra food cost % aggiornato al giorno precedente per singola sede e aggregato gruppo (stesso `profile_id`).
- [ ] Almeno una categoria con acquisti frequenti genera un "ordine consigliato" entro 30gg di dati.
- [ ] "Ordine consigliato" è azionabile in 2 click (click suggestion → carrello precompilato → conferma ordine).
- [ ] Upload CSV di un file Lightspeed di esempio popola fiscal_receipts correttamente.
- [ ] Disconnessione POS rimuove credenziali e mantiene dati storici in read-only.
- [ ] Test E2E: collegamento fake POS (adapter `mock`) → 100 scontrini → food cost visibile.

---

## 16. Milestones

| Fase | Contenuto | Rough estimate |
|------|-----------|----------------|
| **1. Foundations** | enums, tabelle, RLS, helpers pgsodium, feature flag | 2-3 giorni |
| **2. Adapter framework** | interface, 1 adapter reale (Tilby) + mock, tests | 3-4 giorni |
| **3. Webhook + pull infra** | route handlers, edge fn, pg_cron, normalization fn | 3 giorni |
| **4. UI base** | `/finanze`, `/finanze/scontrini`, `/finanze/integrazioni` | 4-5 giorni |
| **5. Reorder engine** | MV aggregate, generator, suggestions UI, notifiche | 3-4 giorni |
| **6. CSV import** | wizard, mapping, parser | 2 giorni |
| **7. Adapter Tier 1 restanti** | Cassa in Cloud, Lightspeed, Scloby | 4-5 giorni (parallelizzabile) |
| **8. Hardening + beta** | observability, retention, performance, rollout | 2-3 giorni |

Totale stimato: ~4-5 settimane di lavoro single-dev focused.
