/**
 * Plan 1C Task 11 — Pagina conferma cliente per modifiche fornitore.
 *
 * Flusso:
 *  - Fornitore accetta parzialmente un ordine → lo split passa a
 *    workflow `pending_customer_confirmation` e il ristorante riceve una
 *    email con link HMAC verso `/ordini/[id]/conferma?token=...`.
 *  - Questa pagina:
 *      1. Verifica stateless il token HMAC (`verifyCustomerConfirmationToken`).
 *      2. Carica split + righe + fornitore via admin client (RLS bypass:
 *         l'autenticazione e' la firma del token, il ristorante potrebbe non
 *         essere loggato e la RLS lato ristorante non coprirebbe comunque
 *         l'accesso senza sessione).
 *      3. Passa al client component il diff (righe accepted / modified /
 *         rejected) e il totale originale vs proposto.
 *      4. Il client chiama `confirmCustomerResponse(splitId, token, accepted)`
 *         e mostra la pagina di esito.
 *
 * Deviazione nota: il plan elenca `customer-confirm-client.tsx` come file
 * separato — implementato come `confirm-client.tsx` nella stessa directory per
 * allinearsi alla convenzione naming usata altrove nel repo
 * (`compare-client.tsx`, `cart-client.tsx`).
 */

import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCustomerConfirmationToken } from "@/lib/orders/customer-confirmation-token";
import { getWorkflowState } from "@/lib/orders/supplier-actions";

import ConfirmClient, {
  type CustomerConfirmLine,
  type CustomerConfirmPayload,
} from "./confirm-client";

type SearchParams = Promise<{ token?: string }>;

type SplitRow = {
  id: string;
  order_id: string;
  supplier_id: string;
  status: string;
  supplier_notes: string | null;
  subtotal: number;
  suppliers: { company_name: string } | null;
};

type LineRow = {
  id: string;
  quantity_requested: number;
  quantity_accepted: number | null;
  unit_price: number;
  status: string;
  rejection_reason: string | null;
  products: { name: string; unit: string } | null;
};

function ErrorCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="mb-6">
        <Link
          href="/ordini"
          className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" /> Torna agli ordini
        </Link>
      </div>
      <Card className="border border-terracotta-light">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-terracotta shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-charcoal mb-2">{title}</h1>
            <p className="text-sm text-sage leading-relaxed">{message}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default async function CustomerConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id: splitId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorCard
        title="Link non valido"
        message="Il link di conferma e' incompleto. Controlla la email ricevuta dal fornitore e apri nuovamente il link."
      />
    );
  }

  // 1. Verifica HMAC stateless (include check scadenza 48h).
  const verify = verifyCustomerConfirmationToken(token, splitId);
  if (!verify.ok) {
    const scaduto = verify.error.toLowerCase().includes("scadut");
    return (
      <ErrorCard
        title={scaduto ? "Link scaduto" : "Link non valido"}
        message={
          scaduto
            ? "Questo link di conferma e' scaduto (validita' 48 ore). Contatta il fornitore per richiedere una nuova email di conferma."
            : "Il token di conferma non e' valido. Potrebbe essere stato modificato o riferirsi a un altro ordine."
        }
      />
    );
  }

  // 2. Carica split + righe con admin client (bypass RLS: auth e' il token).
  const admin = createAdminClient();

  const { data: splitData, error: splitErr } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: SplitRow | null; error: unknown }>;
        };
      };
    };
  })
    .from("order_splits")
    .select(
      "id, order_id, supplier_id, status, supplier_notes, subtotal, suppliers:supplier_id ( company_name )",
    )
    .eq("id", splitId)
    .maybeSingle();

  if (splitErr || !splitData) {
    return (
      <ErrorCard
        title="Ordine non trovato"
        message="Non siamo riusciti a caricare l'ordine associato a questo link."
      />
    );
  }

  const workflow = getWorkflowState(splitData.status, splitData.supplier_notes);

  // Stato gia' finalizzato: mostra esito senza CTA.
  if (workflow !== "pending_customer_confirmation") {
    const alreadyMsg: Record<string, string> = {
      confirmed: "Hai gia' confermato le modifiche proposte dal fornitore. L'ordine e' confermato.",
      cancelled: "Questo ordine risulta annullato. Nessuna ulteriore azione richiesta.",
      rejected: "Il fornitore ha rifiutato l'ordine. Nessuna ulteriore azione richiesta.",
      stock_conflict: "Si e' verificato un conflitto di stock durante la prenotazione. Il fornitore ti ricontattera'.",
    };
    return (
      <ErrorCard
        title="Conferma non piu' necessaria"
        message={
          alreadyMsg[workflow as string] ??
          `L'ordine e' nello stato "${workflow}": la richiesta di conferma non e' piu' attiva.`
        }
      />
    );
  }

  const { data: linesData } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (k: string, opts: { ascending: boolean }) => Promise<{ data: LineRow[] | null }>;
        };
      };
    };
  })
    .from("order_split_items")
    .select(
      "id, quantity_requested, quantity_accepted, unit_price, status, rejection_reason, products:product_id ( name, unit )",
    )
    .eq("order_split_id", splitId)
    .order("id", { ascending: true });

  const lines: CustomerConfirmLine[] = (linesData ?? []).map((l) => ({
    id: l.id,
    productName: l.products?.name ?? "Prodotto",
    unit: l.products?.unit ?? "",
    unitPrice: Number(l.unit_price ?? 0),
    quantityRequested: Number(l.quantity_requested ?? 0),
    quantityAccepted:
      l.quantity_accepted == null ? null : Number(l.quantity_accepted),
    status: l.status as CustomerConfirmLine["status"],
    rejectionReason: l.rejection_reason,
  }));

  // Totali: originale = sum(qty_requested * unit_price); nuovo = sum(qty_accepted * unit_price).
  const originalTotal = lines.reduce(
    (s, l) => s + l.quantityRequested * l.unitPrice,
    0,
  );
  const newTotal = lines.reduce(
    (s, l) => s + (l.quantityAccepted ?? 0) * l.unitPrice,
    0,
  );

  const payload: CustomerConfirmPayload = {
    splitId,
    token,
    supplierName: splitData.suppliers?.company_name ?? "Fornitore",
    shortId: splitId.slice(0, 8),
    lines,
    originalTotal,
    newTotal,
  };

  return <ConfirmClient payload={payload} />;
}
