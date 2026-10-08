"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardPaste, History, Phone, Plus, Search, Send, Trash2, Wand2 } from "lucide-react";
import { Avatar, CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { CREDIT_FLAG_LABEL } from "@/lib/supplier/intel/credit";
import { normalizeText, parseOrderText, type ParsedLine } from "@/lib/supplier/phone-order/parse";
import { createPhoneOrder } from "@/lib/supplier/phone-order/actions";
import type { PhoneOrderContext, PhoneOrderProduct } from "@/lib/supplier/phone-order/queries";

/* ------------------------------------------------------------------ */
/* Client picker                                                        */
/* ------------------------------------------------------------------ */

export function ClientPicker({
  clients,
}: {
  clients: Array<{ id: string; name: string; city: string | null; phone: string | null }>;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = normalizeText(q);
    return n ? clients.filter((c) => normalizeText(`${c.name} ${c.city ?? ""} ${c.phone ?? ""}`).includes(n)) : clients;
  }, [q, clients]);

  return (
    <FCard index={0}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--f-muted)]" aria-hidden />
        <input
          autoFocus
          className="f-input pl-9"
          placeholder="Cerca cliente per nome, città o telefono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cerca cliente"
        />
      </label>
      {shown.length === 0 ? (
        <div className="mt-4">
          <CardEmpty>Nessun cliente attivo trovato.</CardEmpty>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--f-line)]">
          {shown.slice(0, 60).map((c) => (
            <li key={c.id}>
              <Link
                href={`/supplier/ordini/nuovo?cliente=${c.id}`}
                className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-[var(--f-fill)]"
              >
                <Avatar name={c.name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">{c.name}</span>
                  <span className="block text-[12px] text-[var(--f-muted)]">{[c.city, c.phone].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <Plus className="h-4 w-4 text-[var(--f-muted)]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FCard>
  );
}

/* ------------------------------------------------------------------ */
/* Order form                                                           */
/* ------------------------------------------------------------------ */

type Line = { key: string; productId: string; quantity: number; notes: string };

const SOURCE_LABEL: Record<PhoneOrderProduct["priceSource"], string> = {
  listino_cliente: "listino cliente",
  listino_base: "listino base",
  catalogo: "catalogo",
};

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

function qtyFmt(n: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);
}

export function PhoneOrderForm({ ctx }: { ctx: PhoneOrderContext }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [submitting, startSubmit] = useTransition();

  const productById = useMemo(() => new Map(ctx.products.map((p) => [p.id, p])), [ctx.products]);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [paste, setPaste] = useState("");
  const [unmatched, setUnmatched] = useState<ParsedLine[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(ctx.suggestedDelivery?.date ?? "");
  const [channel, setChannel] = useState<"telefono" | "whatsapp" | "visita" | "email">("telefono");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);

  const total = lines.reduce((s, l) => s + l.quantity * (productById.get(l.productId)?.price ?? 0), 0);
  const belowMin = ctx.minOrderAmount !== null && total > 0 && total < ctx.minOrderAmount;

  function addProduct(productId: string, quantity = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...prev, { key: nextKey(), productId, quantity, notes: "" }];
    });
  }

  const results = useMemo(() => {
    const n = normalizeText(search);
    if (n.length < 2) return [];
    const words = n.split(" ").filter(Boolean);
    return ctx.products
      .filter((p) => {
        const hay = normalizeText(`${p.name} ${p.brand ?? ""}`);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 12);
  }, [search, ctx.products]);

  function recognise() {
    const parsed = parseOrderText(
      paste,
      ctx.products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, brand: p.brand })),
    );
    if (parsed.length === 0) {
      toast.error("Nessuna riga riconosciuta nel testo");
      return;
    }
    let added = 0;
    for (const l of parsed) {
      if (l.productId) {
        addProduct(l.productId, l.quantity);
        added++;
      }
    }
    setUnmatched(parsed.filter((l) => !l.productId));
    toast.success(`${added} prodott${added === 1 ? "o" : "i"} aggiunt${added === 1 ? "o" : "i"}: controlla le quantità`);
    if (channel === "telefono") setChannel("whatsapp");
  }

  function repeatLast() {
    if (!ctx.lastOrder) return;
    let n = 0;
    for (const l of ctx.lastOrder.lines) {
      if (productById.has(l.productId)) {
        addProduct(l.productId, l.quantity);
        n++;
      }
    }
    toast.success(`Ultimo ordine ricopiato (${n} righe)`);
  }

  async function submit() {
    if (lines.length === 0) return toast.error("Aggiungi almeno un prodotto");
    if (lines.some((l) => !(l.quantity > 0))) return toast.error("Quantità non valide");
    const c = ctx.credit;
    if (c && (c.flag === "hold" || c.flag === "over")) {
      const ok = await confirm({
        title: c.flag === "hold" ? "Cliente bloccato" : "Fido superato",
        description: `Esposizione stimata ${formatCurrency(c.exposure)}${
          c.creditLimit !== null ? ` su un fido di ${formatCurrency(c.creditLimit)}` : ""
        }. Vuoi inserire comunque l'ordine di ${formatCurrency(total)}?`,
        confirmLabel: "Inserisci comunque",
        tone: "danger",
      });
      if (!ok) return;
    }
    startSubmit(async () => {
      const res = await createPhoneOrder({
        relationshipId: ctx.client.relationshipId,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes || null })),
        deliveryDate: deliveryDate || null,
        deliveryZoneId: ctx.suggestedDelivery && deliveryDate ? ctx.suggestedDelivery.zoneId : null,
        notes: notes || null,
        channel,
        confirmNow,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.warning) toast.warning(res.data.warning);
      else toast.success(res.data.confirmed ? "Ordine inserito e confermato" : "Ordine inserito");
      router.push(`/supplier/ordini/${res.data.splitId}`);
    });
  }

  const usual = ctx.usual.filter((u) => productById.has(u.productId)).slice(0, 16);

  return (
    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      {dialog}
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-2 lg:gap-4">
        <FCard index={0} title="Aggiungi prodotti">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--f-muted)]" aria-hidden />
            <input
              className="f-input pl-9"
              placeholder="Cerca a catalogo (es. datterino, bufala…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  addProduct(results[0].id);
                  setSearch("");
                }
              }}
              aria-label="Cerca prodotto"
            />
          </label>
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-[var(--f-line)] rounded-[12px] border border-[var(--f-line)]">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--f-fill)]"
                    onClick={() => {
                      addProduct(p.id);
                      setSearch("");
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--f-ink)]">{p.name}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--f-muted)]">
                      {formatCurrency(p.price)}/{p.salesUnitLabel ?? p.unit}
                    </span>
                    <Plus className="h-4 w-4 text-[var(--acc-700)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(usual.length > 0 || ctx.lastOrder) && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="f-eyebrow">I suoi prodotti abituali (90 gg)</p>
                {ctx.lastOrder && ctx.lastOrder.lines.length > 0 && (
                  <button type="button" className="f-btn f-btn-soft f-btn-xs" onClick={repeatLast}>
                    <History className="h-3.5 w-3.5" aria-hidden /> Ripeti ultimo ordine ({formatDate(ctx.lastOrder.date)})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {usual.map((u) => {
                  const p = productById.get(u.productId)!;
                  return (
                    <button
                      key={u.productId}
                      type="button"
                      className="f-tag border border-[var(--f-line-strong)] bg-[var(--f-card)] text-[var(--f-ink)] hover:bg-[var(--f-fill)]"
                      onClick={() => addProduct(u.productId, u.lastQuantity)}
                      title={`${u.orders} ordini · ultima quantità ${qtyFmt(u.lastQuantity)}`}
                    >
                      + {p.name} <span className="text-[var(--f-muted)]">×{qtyFmt(u.lastQuantity)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </FCard>

        <FCard
          index={1}
          title={
            <span className="inline-flex items-center gap-2">
              <ClipboardPaste className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Incolla messaggio WhatsApp
            </span>
          }
        >
          <textarea
            className="f-input min-h-[110px] py-2.5"
            placeholder={"5 kg pomodori datterini\n2 casse zucchine\nmozzarella bufala x3"}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-label="Testo dell'ordine"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-[var(--f-muted)]">
              Riconosce quantità, unità e prodotti dal catalogo. Controlla sempre il risultato.
            </p>
            <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={recognise} disabled={!paste.trim()}>
              <Wand2 className="h-4 w-4" aria-hidden /> Riconosci prodotti
            </button>
          </div>
          {unmatched.length > 0 && (
            <div className="mt-3 rounded-[12px] bg-[var(--f-warning-bg)] px-3 py-2">
              <p className="mb-1 text-[12.5px] font-medium text-[var(--f-warning)]">Righe non riconosciute</p>
              <ul className="space-y-1.5">
                {unmatched.map((u, i) => (
                  <li key={`${u.raw}-${i}`} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-[var(--f-ink)]">&ldquo;{u.raw}&rdquo;</span>
                    {u.alternatives.map((id) => {
                      const p = productById.get(id);
                      return p ? (
                        <button
                          key={id}
                          type="button"
                          className="f-btn f-btn-soft f-btn-xs"
                          onClick={() => {
                            addProduct(id, u.quantity);
                            setUnmatched((prev) => prev.filter((x) => x !== u));
                          }}
                        >
                          {p.name}?
                        </button>
                      ) : null;
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FCard>

        <FCard index={2} title={`Righe ordine (${lines.length})`}>
          {lines.length === 0 ? (
            <CardEmpty>Cerca un prodotto, tocca un abituale o incolla il messaggio del cliente.</CardEmpty>
          ) : (
            <ul className="divide-y divide-[var(--f-line)]">
              {lines.map((l) => {
                const p = productById.get(l.productId);
                if (!p) return null;
                return (
                  <li key={l.key} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{p.name}</p>
                      <p className="text-[12px] text-[var(--f-muted)] tabular-nums">
                        {formatCurrency(p.price)}/{p.salesUnitLabel ?? p.unit} · {SOURCE_LABEL[p.priceSource]}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="f-input h-10 w-24 text-right tabular-nums"
                      value={Number.isFinite(l.quantity) ? l.quantity : ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, quantity: v } : x)));
                      }}
                      aria-label={`Quantità ${p.name}`}
                    />
                    <span className="w-24 text-right text-[13.5px] font-medium tabular-nums text-[var(--f-ink)]">
                      {formatCurrency(l.quantity * p.price)}
                    </span>
                    <button
                      type="button"
                      className="f-icon-btn h-9 w-9"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      aria-label={`Rimuovi ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </FCard>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
        <FCard index={3} title="Cliente">
          <div className="flex items-center gap-3">
            <Avatar name={ctx.client.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{ctx.client.name}</p>
              <p className="text-[12px] text-[var(--f-muted)]">{ctx.client.city ?? "—"}</p>
            </div>
            {ctx.client.phone && (
              <a href={`tel:${ctx.client.phone.replace(/\s+/g, "")}`} className="f-icon-btn" aria-label="Chiama il cliente">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
          {ctx.credit && ctx.credit.flag !== "none" && (
            <div className="mt-3">
              <StatusPill tone={ctx.credit.flag === "ok" ? "success" : ctx.credit.flag === "near" ? "warning" : "danger"}>
                {CREDIT_FLAG_LABEL[ctx.credit.flag]}
              </StatusPill>
              <p className="mt-1 text-[12px] text-[var(--f-muted)] tabular-nums">
                Esposizione stimata {formatCurrency(ctx.credit.exposure)}
                {ctx.credit.creditLimit !== null ? ` / fido ${formatCurrency(ctx.credit.creditLimit)}` : ""}
              </p>
            </div>
          )}
        </FCard>

        <FCard index={4} title="Consegna e invio">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="f-label">Data di consegna</span>
              <input type="date" className="f-input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              {ctx.suggestedDelivery && (
                <span className="text-[11.5px] text-[var(--f-muted)]">
                  Zona {ctx.suggestedDelivery.zoneName}: prossima consegna utile {formatDate(ctx.suggestedDelivery.date)} (cut-off ore{" "}
                  {ctx.suggestedDelivery.cutoffTime} del giorno prima)
                </span>
              )}
            </label>
            <label className="grid gap-1">
              <span className="f-label">Canale</span>
              <select className="f-input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="telefono">Telefono</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visita">Visita agente</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="f-label">Note per il magazzino / consegna</span>
              <input className="f-input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-[13px] text-[var(--f-ink)]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--acc-800)]"
                checked={confirmNow}
                onChange={(e) => setConfirmNow(e.target.checked)}
              />
              <span>
                Conferma subito
                <span className="block text-[11.5px] text-[var(--f-muted)]">Accetta tutte le righe e prenota lo stock (FEFO).</span>
              </span>
            </label>
          </div>
          <div className="mt-4 border-t border-[var(--f-line)] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-[var(--f-muted)]">Totale</span>
              <span className="text-[26px] font-medium tabular-nums text-[var(--f-ink)]">{formatCurrency(total)}</span>
            </div>
            {belowMin && (
              <p className="mt-1 text-[12px] text-[var(--f-warning)]">
                Sotto l&apos;ordine minimo di {formatCurrency(ctx.minOrderAmount ?? 0)} (consentito per gli ordini inseriti da voi).
              </p>
            )}
            <button
              type="button"
              className="f-btn f-btn-primary f-btn-block f-btn-lg mt-3"
              onClick={submit}
              disabled={submitting || lines.length === 0}
            >
              <Send className="h-4 w-4" aria-hidden /> {submitting ? "Invio…" : "Inserisci ordine"}
            </button>
            <p className="mt-2 text-[11.5px] text-[var(--f-muted)]">
              Il cliente riceve una notifica con il riepilogo. Prezzi ricalcolati dal listino del cliente al salvataggio.
            </p>
          </div>
        </FCard>
      </div>
    </div>
  );
}
