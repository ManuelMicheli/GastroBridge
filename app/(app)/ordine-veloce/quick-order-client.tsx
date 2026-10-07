"use client";

// Ordine veloce — type or dictate (keyboard microphone) a shopping list,
// "2 kg datterini, 1 cassa limoni", and get cart lines matched to the
// restaurant's suppliers. Deterministic parsing, editable before adding.

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Eraser, Mic, RotateCcw, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { CardEmpty, FCard } from "@/components/fernly/primitives";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { offerToCartItem, type Offer } from "@/lib/restaurants/ordering/types";
import { addKitchenRequests } from "@/lib/restaurants/kitchen/actions";
import { useListMatcher } from "@/components/restaurant/ordering/use-list-matcher";
import { MatchedLines, chosen, lineKey, type LineChoice } from "@/components/restaurant/ordering/matched-lines";

const EXAMPLE = "2 kg pomodori datterini\n1 cassa limoni\n3 mozzarelle fiordilatte\nmezzo kg burro";

export function QuickOrderClient({
  offers,
  timesOrdered,
  initialText,
  canOrder,
  canDraft,
}: {
  offers: Offer[];
  timesOrdered: Record<string, number>;
  initialText: string;
  canOrder: boolean;
  canDraft: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [text, setText] = useState(initialText);
  const deferred = useDeferredValue(text);
  const [choices, setChoices] = useState<Record<string, LineChoice>>({});
  const [pending, startTransition] = useTransition();
  const match = useListMatcher(offers, timesOrdered);
  const matched = useMemo(() => match(deferred), [match, deferred]);

  const picks = matched.map((m, i) => chosen(m, choices[lineKey(m, i)])).filter((p): p is { offer: Offer; qty: number } => !!p && p.qty > 0);
  const total = picks.reduce((s, p) => s + p.offer.price * p.qty, 0);
  const unmatched = matched.filter((m) => m.candidates.length === 0).length;

  function addToCart() {
    if (picks.length === 0) {
      toast.error("Nessuna riga da aggiungere");
      return;
    }
    for (const p of picks) addItem(offerToCartItem(p.offer, p.qty));
    toast.success(`${picks.length} rig${picks.length === 1 ? "a aggiunta" : "he aggiunte"} al carrello`, {
      action: { label: "Vai al carrello", onClick: () => router.push("/carrello") },
    });
    setText("");
    setChoices({});
  }

  function toKitchenList() {
    if (matched.length === 0) return;
    startTransition(async () => {
      const res = await addKitchenRequests(
        matched.map((m, i) => {
          const p = chosen(m, choices[lineKey(m, i)]);
          return {
            rawText: m.line.raw.slice(0, 300),
            productName: (p?.offer.name ?? m.line.text).slice(0, 200),
            quantity: p ? p.qty || null : m.line.explicitQty ? m.line.qty : null,
            unit: p?.offer.unit ?? m.line.unit,
            note: null,
            offer: p?.offer ?? null,
          };
        }),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Aggiunto alla lista cucina");
      setText("");
      setChoices({});
      router.push("/lista-cucina");
    });
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Ordine veloce"
        subtitle="Scrivi o detta la lista della spesa come la diresti al telefono: la trasformiamo in righe d'ordine dai tuoi fornitori."
        actions={
          <Link href="/riordina" className="f-btn f-btn-outline">
            <RotateCcw className="h-4 w-4" /> Riordino rapido
          </Link>
        }
      />

      {offers.length === 0 ? (
        <FCard>
          <CardEmpty action={<Link href="/fornitori" className="f-btn f-btn-sm f-btn-primary">Collega fornitori</Link>}>
            Collega un fornitore o importa un listino per usare l&apos;ordine veloce.
          </CardEmpty>
        </FCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-5">
          <FCard index={0} className="xl:col-span-2" title="La tua lista">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              rows={9}
              autoFocus
              className="f-input w-full resize-y px-3 py-2.5 text-[15px] leading-relaxed"
              aria-label="Lista della spesa"
            />
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--f-muted)]">
              <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Una riga per prodotto (o separa con la virgola). Dal telefono usa il microfono della tastiera per dettare.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!text && (
                <button type="button" className="f-btn f-btn-sm f-btn-ghost" onClick={() => setText(EXAMPLE)}>
                  Prova un esempio
                </button>
              )}
              {text && (
                <button
                  type="button"
                  className="f-btn f-btn-sm f-btn-ghost"
                  onClick={() => {
                    setText("");
                    setChoices({});
                  }}
                >
                  <Eraser className="h-3.5 w-3.5" /> Svuota
                </button>
              )}
            </div>
          </FCard>

          <FCard
            index={1}
            className="xl:col-span-3"
            title="Righe trovate"
            action={
              matched.length > 0 ? (
                <span className="text-[12.5px] text-[var(--f-muted)]">
                  {matched.length - unmatched}/{matched.length} riconosciute
                </span>
              ) : null
            }
          >
            {matched.length === 0 ? (
              <CardEmpty>Le righe compaiono qui mentre scrivi.</CardEmpty>
            ) : (
              <>
                <MatchedLines
                  matched={matched}
                  choices={choices}
                  onChoice={(k, c) => setChoices((p) => ({ ...p, [k]: c }))}
                />
                <footer className="mt-4 flex flex-col gap-3 border-t border-[var(--f-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[13px] text-[var(--f-muted)]">
                    <span className="block text-[17px] font-semibold tabular-nums text-[var(--f-ink)]">
                      {formatCurrency(total)}
                    </span>
                    {picks.length} righe · IVA esclusa
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canDraft && (
                      <button type="button" className="f-btn f-btn-outline" onClick={toKitchenList} disabled={pending}>
                        <ChefHat className="h-4 w-4" /> In lista cucina
                      </button>
                    )}
                    {canOrder && (
                      <button type="button" className="f-btn f-btn-primary" onClick={addToCart} disabled={picks.length === 0}>
                        <ShoppingCart className="h-4 w-4" /> Aggiungi al carrello
                      </button>
                    )}
                  </div>
                </footer>
              </>
            )}
          </FCard>
        </div>
      )}
    </div>
  );
}
