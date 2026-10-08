# Finanze — Fatture fornitori, food cost, collegamenti

Status: implemented on `feat/invoices-foodcost-final` (migrations NOT applied).

## What the restaurateur gets

| Screen | Route | What it does |
|---|---|---|
| Panoramica | `/finanze` | Soldi recuperati / Da recuperare / spesa del mese / food cost, fatture da guardare, scadenze, stato collegamenti, piatti sopra obiettivo, prezzi in aumento; cassa (owner only) |
| Fatture fornitori | `/finanze/fatture` | Inbox (da verificare / OK / anomalie / contestata / risolta), search + supplier filter, drag & drop `.xml` `.p7m` `.zip`, scadenze |
| Dettaglio fattura | `/finanze/fatture/[id]` | Ordine ↔ DDT/ricevuto ↔ fattura per riga, differenze evidenziate con € impatto, **Contesta** (messaggio per nota di credito: chat partnership / email / copia), chiusura automatica alla TD04, pagamenti, collega P.IVA sconosciuta |
| Storico prezzi | `/finanze/fatture/prezzi` | Prezzo pagato per prodotto, fattura dopo fattura |
| Collega fatture | `/finanze/fatture/collega` | Wizard SDI su una schermata (registrazione, codice destinatario, 3 passi AdE, avviso fornitori, import storico, stato live) |
| Food cost | `/finanze/ricette`, `/finanze/ricette/[id]`, `/finanze/ricette/menu` | Schede tecniche con semilavorati, resa, scarto, costo live (fattura → catalogo → listino → manuale), alert, collegamento piatti POS, teorico vs reale (solo acquisti), menu engineering |
| Stato collegamenti | `/finanze/collegamenti` | Casse POS + SDI: salute, ultimo dato, azione per sistemare; aiuto contestuale (ex Guida) |

## Server

* Pipeline: `lib/invoices/server/pipeline.ts` (upload, webhook, cron share it).
* Provider adapters: `lib/invoices/providers/*` (`openapi`, `mock`), chosen by `INVOICES_SDI_PROVIDER`.
* Webhook: `POST /api/invoices/webhook/openapi` (shared secret header, idempotent event store, processing after the 202).
* Cron: `GET|POST /api/invoices/cron` (`Authorization: Bearer $CRON_SECRET`): retries events, pulls missed invoices, sends ONE daily digest per restaurant.
* Notifications: `lib/invoices/server/notify.ts` on top of `lib/notifications/restaurant.ts` (owner + `analytics.financial`); immediate only for high-severity anomalies, credit notes that settle a dispute and big food-cost jumps.
* Permissions: read `analytics.financial`, write `settings.manage` (server actions via `getFinanceAccess`, RLS via `private.fin_can`). Finanze stays hidden in the sidebar for team members; MFA step-up on `/finanze` unchanged.

## Go-live (Openapi SDI)

1. Openapi account (console.openapi.com), enable the **SDI** API, create a token (sandbox first).
2. Vercel env: `OPENAPI_SDI_TOKEN`, `OPENAPI_SDI_ENV=sandbox|production`, `INVOICES_WEBHOOK_SECRET` (long random), `NEXT_PUBLIC_APP_URL` (public https origin), `CRON_SECRET`; optional `OPENAPI_SDI_RECIPIENT_CODE`, `OPENAPI_SDI_BASE_URL`, `INVOICES_SDI_PROVIDER=openapi`.
3. The callback URL registered per company is `${NEXT_PUBLIC_APP_URL}/api/invoices/webhook/openapi`.
4. Verify the `TODO(openapi)` assumptions in `lib/invoices/providers/openapi.ts` on the sandbox (auth scheme, list filters, download format, recipient code).
5. Apply migrations `20261010010000`, `20261010010100`, `20261010010200`.
