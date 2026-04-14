# Cataloghi Fornitori & Comparazione Prezzi — Design

**Data:** 2026-04-14
**Area:** App ristoratore (`app/(app)`)
**Obiettivo:** permettere al ristoratore di inserire manualmente i cataloghi (listini) dei propri fornitori, importandoli da file Excel/CSV, e confrontarli tra loro per identificare il prezzo migliore per ogni prodotto e il risparmio potenziale.

## Contesto

Funzione di comparazione "personale" del ristoratore. I cataloghi sono **isolati** dai `products` della piattaforma — non alimentano il marketplace pubblico, servono solo al ristoratore che li carica. Primo test end-to-end della value proposition del prodotto (comparazione prezzi stile Facile.it) prima che la piattaforma abbia fornitori veri a regime.

## Schema DB

Due nuove tabelle in `supabase/migrations/`:

### `restaurant_catalogs`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `restaurant_id` | `uuid` FK → `restaurants.id` ON DELETE CASCADE | NOT NULL |
| `supplier_name` | `text` | NOT NULL, nome fornitore come lo vede il ristoratore |
| `delivery_days` | `int` | NULL, CHECK `delivery_days >= 0`, tempo di consegna in giorni lavorativi |
| `min_order_amount` | `numeric(10,2)` | NULL, CHECK `min_order_amount >= 0`, soglia minima d'ordine (€) |
| `notes` | `text` | NULL, note libere (contatti, agente, ecc.) |
| `created_at` | `timestamptz` default `now()` | |
| `updated_at` | `timestamptz` default `now()` | trigger di update |

Indice: `(restaurant_id)`.

### `restaurant_catalog_items`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `catalog_id` | `uuid` FK → `restaurant_catalogs.id` ON DELETE CASCADE | NOT NULL |
| `product_name` | `text` | NOT NULL |
| `product_name_normalized` | `text` | NOT NULL, generato da `lower(trim(regexp_replace(product_name, '\s+', ' ', 'g')))` |
| `unit` | `text` | NOT NULL (es. `kg`, `L`, `pz`, `cf`) |
| `price` | `numeric(10,2)` | NOT NULL, CHECK `price >= 0` |
| `notes` | `text` | NULL |
| `created_at` | `timestamptz` default `now()` | |

Indici: `(catalog_id)`, `(product_name_normalized, unit)` per il pivot di confronto.

### RLS

Policy su entrambe le tabelle: un ristoratore può SELECT/INSERT/UPDATE/DELETE solo le righe il cui `restaurant_id` corrisponde al profilo autenticato (via join su `restaurant_catalogs.restaurant_id`). Pattern coerente con le RLS già presenti (`20260325000013_create_rls_policies.sql`).

## Navigazione

Nuova voce sidebar "Cataloghi" (icona `BookMarked` di lucide-react) in `app/(app)/layout.tsx`, nella sezione principale tra `Fornitori` e `Ordini`. Anche in mobile nav.

## Pagine

### 1. `/cataloghi` — lista cataloghi

- Griglia di **card** (`DarkCard`, coerente con dashboard dark): una per catalogo, con `supplier_name`, numero prodotti, **tempo di consegna** (`X gg`), **soglia minima d'ordine** (`€ Y`), data aggiornamento, link "Apri".
- Stato vuoto: illustrazione + CTA "Crea il primo catalogo".
- Header: bottone primario "Nuovo catalogo" (apre dialog con `supplier_name`, `delivery_days`, `min_order_amount`, `notes`) e bottone secondario "Confronta tutti" (disabilitato se < 2 cataloghi) → `/cataloghi/confronta`.

### 2. `/cataloghi/[id]` — dettaglio catalogo

- Header: nome fornitore (editable inline), campi `delivery_days` e `min_order_amount` editabili inline, note, contatori (`N prodotti`, `Prezzo medio`), azioni "Importa da file", "Aggiungi prodotto", "Elimina catalogo" (conferma).
- **Tabella prodotti**: colonne `Nome`, `Unità`, `Prezzo`, `Note`, azioni (edit inline, elimina). Ordinabile per colonna, ricerca con debounce.
- Paginazione lato client fino a 5.000 righe.

### 3. Wizard "Importa da file"

Dialog a 3 step:

**Step 1 — Upload**
- Drag&drop + file picker. Accetta `.xlsx`, `.xls`, `.csv`.
- Vincoli: max `2 MB`, max `5.000` righe dati (escluso header).
- Errori mostrati inline (file troppo grande, formato non supportato, file vuoto).
- Parsing client-side:
  - CSV → `papaparse`
  - XLSX/XLS → `xlsx` (SheetJS) — solo primo foglio
- Dopo parsing, i dati restano in state React (non si salvano finché non si conferma lo step 3).

**Step 2 — Mappa colonne**
- Anteprima delle prime 5 righe in tabella.
- 3 `<select>`, uno per ogni campo target: `Nome prodotto`, `Unità`, `Prezzo`. Le opzioni sono i nomi colonna del file (header riga 1) oppure `Col 1`, `Col 2`… se header assente (toggle "Il file ha un'intestazione").
- Auto-suggerimento: matching case-insensitive dei nomi header con sinonimi comuni (es. "descrizione" / "articolo" / "nome" → Nome prodotto; "um" / "u.m." / "unità" → Unità; "prezzo" / "costo" / "€" → Prezzo).
- Link "Scarica template" scarica `template-catalogo.csv` con header `nome,unita,prezzo` e 2 righe esempio (file statico in `public/`).

**Step 3 — Anteprima & conferma**
- Tabella con righe parsate in base al mapping. Ogni riga ha stato:
  - ✅ **Valida** (nome non vuoto, unità non vuota, prezzo convertibile a numero `>= 0`)
  - ⚠️ **Scartata** con motivo (prezzo non numerico, nome vuoto, prezzo negativo)
- Conteggio "N valide / M scartate".
- Radio: **Sostituisci catalogo** (svuota e reinserisce) vs **Aggiungi al catalogo** (append).
- Bottone "Conferma importazione": insert batch via server action in chunk da 500 righe. Durante l'insert: spinner + progress.
- Al termine: toast "Importate N righe" + reset wizard + refresh tabella.

Normalizzazione prezzo in import: accetta `12,50` / `12.50` / `€ 12.50` / `12.50€` — strip di valuta/spazi, virgola→punto, parse a numero. Righe non parsabili → scartate.

Normalizzazione `unit` all'insert: `trim + lowercase`. `kg`, `l`, `pz`, `cf`, `g`, `ml` sono i valori più comuni attesi, ma non vengono vincolati a un enum (testo libero — il matching del confronto è esatto).

### 4. `/cataloghi/confronta` — tabella pivot di comparazione

- Header: selettore multiplo dei cataloghi inclusi (default: tutti). Almeno 2 cataloghi selezionati altrimenti bottone disabilitato con tooltip.
- Pannello **Pesi del punteggio composito** (slider/input numerici): `w_prezzo` e `w_consegna`, normalizzati a somma 1. Default `70%` prezzo, `30%` consegna. Persistiti in `localStorage` per ristoratore.
- **Tabella pivot** principale:
  - Righe = prodotti unici, raggruppati per `(product_name_normalized, unit)`. Label riga = `product_name` (primo valore incontrato) + `unit`.
  - Colonne = un fornitore per colonna + 2 colonne speciali a destra: **Miglior prezzo** e **Miglior composito**.
  - Header di ogni colonna fornitore mostra sotto il nome: `🚚 X gg` e `💶 min € Y` (se presenti).
  - Celle fornitore: prezzo del fornitore per quel prodotto, oppure `—` se non lo offre.
  - La cella col **prezzo minimo** della riga ha highlight `accent-green` (background tenue + testo accent). Cella con il **miglior punteggio composito** ha un **badge ⭐** (anche se coincide col min-prezzo).
  - Se un solo fornitore offre il prodotto, nessun highlight (non c'è confronto).
- Calcolo **punteggio composito** (per riga, solo sui fornitori che offrono il prodotto):
  1. `norm_prezzo_f = (price_f - min_price_row) / (max_price_row - min_price_row)` → `0` per il più basso, `1` per il più alto. Se tutti uguali, `0`.
  2. `norm_consegna_f = (days_f - min_days_row) / (max_days_row - min_days_row)`; se `delivery_days` mancante → escludere il fornitore dal composito per quella riga (solo per quella).
  3. `score_f = w_prezzo * norm_prezzo_f + w_consegna * norm_consegna_f` (più basso = meglio).
  4. Colonna "Miglior composito" mostra il nome del fornitore vincente + il suo prezzo.
- Riga riepilogo in fondo:
  - **Totale per fornitore X** (somma di tutti i suoi prezzi filtrati sui prodotti che ha). Sotto la cella: confronto con `min_order_amount` → se `totale < min_order_amount` → chip rosso "Sotto soglia minima (mancano € Z)".
  - **Costo basket ottimale (prezzo)** (somma del minimo per ogni prodotto).
  - **Costo basket ottimale (composito)** (somma dei prezzi dei "vincitori" per composito).
  - Chip **Risparmio potenziale**: `totale_fornitore_più_caro - basket_ottimale_prezzo`, con % di risparmio.
- Filtri: input ricerca per nome prodotto, toggle "Mostra solo prodotti offerti da ≥ 2 fornitori".
- Export: bottone "Esporta CSV" che scarica il pivot corrente (incluse colonne composito e info fornitore).

Fetch dati: server component che carica tutti i `restaurant_catalog_items` del ristoratore joinando `restaurant_catalogs` (inclusi `delivery_days`, `min_order_amount`). Pivot e calcolo composito client-side per permettere slider dei pesi reattivi (il volume è limitato: ~5k righe × 5–10 cataloghi = 50k righe max, gestibili in memoria).

## Componenti React

Nuove cartelle / file (indicativi, ai fini dello scope):
- `app/(app)/cataloghi/page.tsx` — lista
- `app/(app)/cataloghi/[id]/page.tsx` — dettaglio
- `app/(app)/cataloghi/[id]/catalog-detail-client.tsx` — tabella + dialogs
- `app/(app)/cataloghi/confronta/page.tsx` — pivot
- `app/(app)/cataloghi/confronta/compare-client.tsx` — pivot interattivo
- `components/dashboard/restaurant/catalog-card.tsx`
- `components/dashboard/restaurant/catalog-import-wizard.tsx`
- `components/dashboard/restaurant/catalog-item-row.tsx`
- `components/dashboard/restaurant/catalog-compare-table.tsx`
- `lib/catalogs/parse-file.ts` — funzioni pure di parsing CSV/XLSX + normalizzazione prezzo
- `lib/catalogs/actions.ts` — server actions (`createCatalog`, `updateCatalog`, `deleteCatalog`, `upsertItems`, `deleteItem`)
- `lib/catalogs/compare.ts` — funzioni pure di pivot/calcolo basket ottimale

## Dipendenze nuove

- `xlsx` (SheetJS) per Excel
- `papaparse` (+ `@types/papaparse`) per CSV

Entrambe girano client-side nel wizard (no parsing server-side).

## Validazione

Zod (v4) schemas in `lib/catalogs/schemas.ts`:
- `CatalogSchema` (supplier_name `min(1).max(120)`, delivery_days `int().nonnegative().max(365).optional()`, min_order_amount `number().nonnegative().max(1_000_000).optional()`, notes `max(500)`)
- `CatalogItemSchema` (product_name `min(1).max(200)`, unit `min(1).max(20)`, price `number().nonnegative().max(1_000_000)`, notes `max(200)`)
- `ImportRowSchema` usato durante lo step 3
- `CompareWeightsSchema` (w_prezzo + w_consegna, entrambi `[0,1]`, somma ≈ 1)

Validazione sia lato client (feedback immediato nel wizard) sia nelle server actions.

## Error handling

- File upload > 2MB / formato non valido → errore inline, nessuna action server.
- Parsing fallito (file corrotto, foglio vuoto) → messaggio "Impossibile leggere il file" + riprova.
- Errore Supabase in insert batch → rollback dell'import (no partial commit: uso transazione via RPC o single insert batch; se RPC non praticabile, insert in una sola `insert([...])` call che è atomica per chunk).
- RLS violation → catturata come errore generico "Operazione non consentita".

## Test (manuali per il test end-to-end)

- Upload CSV piccolo (5 righe) → import OK, righe visibili.
- Upload XLSX con header in italiano ("Descrizione", "U.M.", "Prezzo €") → auto-mapping corretto.
- Upload con prezzo "12,50 €" → parsato a `12.50`.
- Upload riga con prezzo non numerico → scartata, non interrompe.
- 2 cataloghi con stessi prodotti a prezzi diversi → pivot evidenzia il migliore (prezzo) e il miglior composito; calcola risparmio.
- 2 cataloghi con prodotti parzialmente sovrapposti → righe con cella `—` dove il fornitore non ha il prodotto.
- Modifica pesi composito (es. 100% consegna) → la colonna "Miglior composito" cambia coerentemente.
- Fornitore con `min_order_amount` > totale basket → chip "Sotto soglia" con delta mancante.
- Fornitore senza `delivery_days` → escluso dal composito per tutte le righe (ma presente nel confronto prezzo).
- Eliminazione catalogo → cascade sugli items.
- Login come ristoratore B → non vede i cataloghi di ristoratore A (RLS).

## Fuori scope (esplicito)

- Integrazione con i `products` ufficiali della piattaforma (nessuna "promozione" automatica di un item a prodotto marketplace).
- Fuzzy matching dei nomi prodotto (solo confronto esatto su `product_name_normalized + unit`).
- Storico prezzi, trend nel tempo.
- Foto / immagini prodotto.
- Import da PDF di fatture / OCR.
- Condivisione cataloghi tra ristoratori.
- Alert automatici su variazioni prezzo.

## Open points (nessuno bloccante)

- Nome icona sidebar: `BookMarked` o `FileSpreadsheet` — decisione in fase implementativa.
- Layout mobile del pivot: fallback a vista "per prodotto" (un card per prodotto, lista fornitori ordinata per prezzo) se viewport < `md`.
