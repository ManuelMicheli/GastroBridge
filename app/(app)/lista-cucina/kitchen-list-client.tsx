"use client";

// Lista cucina — the brigade writes what it needs during service; whoever can
// order approves it straight into the cart (or rejects it).

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChefHat, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { Avatar, CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { useCart } from "@/lib/hooks/useCart";
import { cn, formatCurrency } from "@/lib/utils/formatters";
import { formatQty, offerToCartItem, type Offer } from "@/lib/restaurants/ordering/types";
import { addKitchenRequests, decideKitchenRequests, deleteKitchenRequest } from "@/lib/restaurants/kitchen/actions";
import { useListMatcher } from "@/components/restaurant/ordering/use-list-matcher";
import { MatchedLines, chosen, lineKey, type LineChoice } from "@/components/restaurant/ordering/matched-lines";

export type KitchenRequest = {
  id: string;
  rawText: string;
  productName: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  offer: Offer | null;
  status: "open" | "approved" | "rejected";
  requestedBy: string;
  requestedByName: string;
  createdAt: string;
  decidedAt: string | null;
};

const timeFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function KitchenListClient({
  requests,
  offers,
  timesOrdered,
  userId,
  canAdd,
  canApprove,
  unavailable,
}: {
  requests: KitchenRequest[];
  offers: Offer[];
  timesOrdered: Record<string, number>;
  userId: string;
  canAdd: boolean;
  canApprove: boolean;
  unavailable: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const [choices, setChoices] = useState<Record<string, LineChoice>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const match = useListMatcher(offers, timesOrdered);
  const matched = useMemo(() => match(deferred), [match, deferred]);
  const offerByKey = useMemo(() => new Map(offers.map((o) => [o.key, o])), [offers]);

  const open = requests.filter((r) => r.status === "open");
  const decided = requests.filter((r) => r.status !== "open");

  function add() {
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
      toast.success(`${res.data.added} richiest${res.data.added === 1 ? "a aggiunta" : "e aggiunte"}`);
      setText("");
      setChoices({});
      router.refresh();
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approve(ids: string[]) {
    const items = open.filter((r) => ids.includes(r.id));
    let added = 0;
    for (const r of items) {
      const offer = r.offer ? offerByKey.get(r.offer.key) ?? null : null;
      if (offer) {
        addItem(offerToCartItem(offer, r.quantity ?? 1));
        added += 1;
      }
    }
    startTransition(async () => {
      const res = await decideKitchenRequests({ ids, status: "approved" });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const missing = items.length - added;
      toast.success(
        `${added} rig${added === 1 ? "a" : "he"} nel carrello${missing > 0 ? ` · ${missing} da cercare a mano` : ""}`,
        { action: { label: "Carrello", onClick: () => router.push("/carrello") } },
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  function reject(ids: string[]) {
    startTransition(async () => {
      const res = await decideKitchenRequests({ ids, status: "rejected" });
      if (!res.ok) toast.error(res.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteKitchenRequest(id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const selectedIds = [...selected].filter((id) => open.some((r) => r.id === id));

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Lista cucina"
        subtitle="La brigata scrive cosa manca, chi ordina approva e manda tutto nel carrello. Niente più lavagna e foto su WhatsApp."
      />

      {unavailable && (
        <p className="mb-4 rounded-[12px] bg-[var(--f-warning-bg)] px-3 py-2 text-[13px] text-[var(--f-warning)]">
          Lista cucina non ancora attiva: vanno applicate le migrazioni del database.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-5">
        <div className="space-y-3 lg:space-y-4 xl:col-span-3">
          <FCard
            index={0}
            title={`Da ordinare${open.length > 0 ? ` · ${open.length}` : ""}`}
            action={
              canApprove && open.length > 0 ? (
                <button
                  type="button"
                  className="f-btn f-btn-xs f-btn-outline"
                  onClick={() => setSelected(selectedIds.length === open.length ? new Set() : new Set(open.map((r) => r.id)))}
                >
                  {selectedIds.length === open.length ? "Deseleziona" : "Seleziona tutto"}
                </button>
              ) : null
            }
          >
            {open.length === 0 ? (
              <CardEmpty>Niente in lista. {canAdd ? "Aggiungi quello che manca qui accanto." : ""}</CardEmpty>
            ) : (
              <ul className="divide-y divide-[var(--f-line)]">
                {open.map((r) => {
                  const offer = r.offer ? offerByKey.get(r.offer.key) ?? null : null;
                  const isSel = selected.has(r.id);
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          aria-pressed={isSel}
                          aria-label={`Seleziona ${r.productName}`}
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                            isSel
                              ? "border-[var(--acc-800)] bg-[var(--acc-800)] text-white"
                              : "border-[var(--f-line-strong)] text-transparent",
                          )}
                        >
                          <Check className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-[var(--f-ink)]">
                          {r.quantity !== null ? `${formatQty(r.quantity)} ${r.unit ?? ""} · ` : ""}
                          {r.productName}
                        </p>
                        <p className="truncate text-[12px] text-[var(--f-muted)]">
                          {offer
                            ? `${offer.supplierName} · ${formatCurrency(offer.price)}/${offer.unit}`
                            : "Prodotto da scegliere"}
                          {" · "}
                          {r.requestedByName}, {timeFmt.format(new Date(r.createdAt))}
                        </p>
                      </div>
                      {!offer && (
                        <Link
                          href={`/cerca?q=${encodeURIComponent(r.productName)}`}
                          className="f-icon-btn"
                          aria-label={`Cerca ${r.productName}`}
                        >
                          <Search className="h-4 w-4" />
                        </Link>
                      )}
                      {(canApprove || (r.requestedBy === userId && r.status === "open")) && (
                        <button
                          type="button"
                          className="f-icon-btn"
                          onClick={() => remove(r.id)}
                          disabled={pending}
                          aria-label={`Elimina ${r.productName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canApprove && selectedIds.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[var(--f-line)] pt-3">
                <button type="button" className="f-btn f-btn-sm f-btn-outline" onClick={() => reject(selectedIds)} disabled={pending}>
                  <X className="h-3.5 w-3.5" /> Rifiuta
                </button>
                <button type="button" className="f-btn f-btn-sm f-btn-primary" onClick={() => approve(selectedIds)} disabled={pending}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Approva e metti nel carrello ({selectedIds.length})
                </button>
              </div>
            )}
          </FCard>

          {decided.length > 0 && (
            <FCard index={2} title="Ultime decisioni">
              <ul className="space-y-1.5">
                {decided.slice(0, 12).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-[13px]">
                    <StatusPill tone={r.status === "approved" ? "success" : "neutral"}>
                      {r.status === "approved" ? "Ordinato" : "Rifiutato"}
                    </StatusPill>
                    <span className="min-w-0 flex-1 truncate text-[var(--f-ink-2)]">
                      {r.quantity !== null ? `${formatQty(r.quantity)} ${r.unit ?? ""} ` : ""}
                      {r.productName}
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--f-muted)]">{r.requestedByName}</span>
                  </li>
                ))}
              </ul>
            </FCard>
          )}
        </div>

        {canAdd && (
          <FCard index={1} className="xl:col-span-2" title="Cosa manca?">
            <div className="flex items-start gap-3">
              <Avatar name="Cucina" size={36} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={"2 kg vongole\nprezzemolo\n1 cassa limoni"}
                className="f-input min-w-0 flex-1 resize-y px-3 py-2.5 text-[15px]"
                aria-label="Cosa manca"
              />
            </div>
            {matched.length > 0 && (
              <div className="mt-3">
                <MatchedLines matched={matched} choices={choices} onChoice={(k, c) => setChoices((p) => ({ ...p, [k]: c }))} />
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <button type="button" className="f-btn f-btn-primary" onClick={add} disabled={pending || matched.length === 0}>
                <Plus className="h-4 w-4" /> Aggiungi alla lista
              </button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--f-muted)]">
              <ChefHat className="h-3.5 w-3.5" /> Chi può ordinare riceve una notifica.
            </p>
          </FCard>
        )}
      </div>
    </div>
  );
}
