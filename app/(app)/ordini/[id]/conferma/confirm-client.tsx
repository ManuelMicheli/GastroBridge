"use client";

/**
 * Plan 1C Task 11 — client component per la pagina conferma cliente.
 *
 * Mostra il diff delle righe:
 *  - accepted : riga ok (verde);
 *  - modified : qty richiesta → qty proposta (evidenziata in ambra);
 *  - rejected : riga rifiutata (rossa, con motivo se presente).
 *
 * Espone due CTA che chiamano `confirmCustomerResponse` e, in base all'esito,
 * mostrano la schermata di conferma finale (confirmed / cancelled /
 * stock_conflict / error).
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackageCheck,
  PackageX,
  CircleSlash,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";
import { confirmCustomerResponse } from "@/lib/orders/supplier-actions";

export type CustomerConfirmLine = {
  id: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantityRequested: number;
  quantityAccepted: number | null;
  status: "pending" | "accepted" | "modified" | "rejected";
  rejectionReason: string | null;
};

export type CustomerConfirmPayload = {
  splitId: string;
  token: string;
  supplierName: string;
  shortId: string;
  lines: CustomerConfirmLine[];
  originalTotal: number;
  newTotal: number;
};

type Outcome =
  | { kind: "confirmed" }
  | { kind: "cancelled" }
  | { kind: "stock_conflict" }
  | { kind: "error"; message: string };

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "confirmed") {
    return (
      <Card className="border border-forest-light">
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <PackageCheck className="h-12 w-12 text-forest" />
          <h2 className="text-2xl font-bold text-charcoal">Ordine confermato</h2>
          <p className="text-sm text-sage max-w-md">
            Hai approvato le modifiche proposte. Il fornitore ha riservato lo
            stock e riceverai una notifica quando l&apos;ordine sara&apos; in preparazione.
          </p>
        </div>
      </Card>
    );
  }
  if (outcome.kind === "cancelled") {
    return (
      <Card className="border border-terracotta-light">
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <PackageX className="h-12 w-12 text-terracotta" />
          <h2 className="text-2xl font-bold text-charcoal">Ordine annullato</h2>
          <p className="text-sm text-sage max-w-md">
            Hai rifiutato le modifiche proposte. L&apos;ordine e&apos; stato annullato e
            nessun importo verra&apos; addebitato.
          </p>
        </div>
      </Card>
    );
  }
  if (outcome.kind === "stock_conflict") {
    return (
      <Card className="border border-terracotta-light">
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <CircleSlash className="h-12 w-12 text-terracotta" />
          <h2 className="text-2xl font-bold text-charcoal">Stock non disponibile</h2>
          <p className="text-sm text-sage max-w-md">
            Nel frattempo lo stock del fornitore non e&apos; piu&apos; sufficiente per
            riservare l&apos;intero ordine. Il fornitore ti ricontattera&apos; a breve.
          </p>
        </div>
      </Card>
    );
  }
  return (
    <Card className="border border-terracotta-light">
      <div className="flex flex-col items-center text-center py-6 gap-3">
        <AlertCircle className="h-12 w-12 text-terracotta" />
        <h2 className="text-2xl font-bold text-charcoal">Impossibile completare</h2>
        <p className="text-sm text-sage max-w-md">{outcome.message}</p>
      </div>
    </Card>
  );
}

function LineRow({ line }: { line: CustomerConfirmLine }) {
  const qtyAcc = line.quantityAccepted ?? 0;
  const subtotalOrig = line.quantityRequested * line.unitPrice;
  const subtotalNew = qtyAcc * line.unitPrice;

  if (line.status === "accepted") {
    return (
      <div className="flex items-start justify-between gap-3 py-3 border-t border-sage-muted/20 first:border-0">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <CheckCircle2 className="h-4 w-4 text-forest shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal truncate">
              {line.productName}
            </p>
            <p className="text-xs text-sage font-mono">
              {line.quantityRequested} {line.unit} × {formatCurrency(line.unitPrice)}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge variant="success">Accettata</Badge>
          <p className="text-sm font-mono text-charcoal mt-1">
            {formatCurrency(subtotalOrig)}
          </p>
        </div>
      </div>
    );
  }

  if (line.status === "modified") {
    return (
      <div className="flex items-start justify-between gap-3 py-3 border-t border-sage-muted/20 first:border-0 bg-terracotta-light/20 -mx-6 px-6">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal truncate">
              {line.productName}
            </p>
            <p className="text-xs font-mono text-charcoal">
              <span className="text-sage line-through">
                {line.quantityRequested} {line.unit}
              </span>
              <span className="mx-2">→</span>
              <span className="font-bold text-terracotta">
                {qtyAcc} {line.unit}
              </span>
              <span className="text-sage"> × {formatCurrency(line.unitPrice)}</span>
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge variant="warning">Modificata</Badge>
          <p className="text-sm font-mono text-charcoal mt-1">
            <span className="text-sage line-through text-xs">
              {formatCurrency(subtotalOrig)}
            </span>{" "}
            <span className="font-bold">{formatCurrency(subtotalNew)}</span>
          </p>
        </div>
      </div>
    );
  }

  if (line.status === "rejected") {
    return (
      <div className="flex items-start justify-between gap-3 py-3 border-t border-sage-muted/20 first:border-0 opacity-75">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal line-through truncate">
              {line.productName}
            </p>
            <p className="text-xs text-sage font-mono line-through">
              {line.quantityRequested} {line.unit} × {formatCurrency(line.unitPrice)}
            </p>
            {line.rejectionReason && (
              <p className="text-xs text-red-700 mt-1 italic">
                Motivo: {line.rejectionReason}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge className="bg-red-100 text-red-700">Rifiutata</Badge>
          <p className="text-sm font-mono text-sage line-through mt-1">
            {formatCurrency(subtotalOrig)}
          </p>
        </div>
      </div>
    );
  }

  // pending — non dovrebbe comparire qui (split gia' processato dal fornitore).
  return (
    <div className="flex justify-between py-3 border-t border-sage-muted/20 first:border-0">
      <span className="text-sm text-charcoal">{line.productName}</span>
      <span className="text-sm font-mono text-sage">
        {line.quantityRequested} {line.unit}
      </span>
    </div>
  );
}

export default function ConfirmClient({
  payload,
}: {
  payload: CustomerConfirmPayload;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isPending, startTransition] = useTransition();

  const { supplierName, shortId, lines, originalTotal, newTotal, splitId, token } = payload;

  const counts = lines.reduce(
    (acc, l) => {
      if (l.status === "accepted") acc.accepted++;
      else if (l.status === "modified") acc.modified++;
      else if (l.status === "rejected") acc.rejected++;
      return acc;
    },
    { accepted: 0, modified: 0, rejected: 0 },
  );

  const diff = newTotal - originalTotal;

  const submit = (accepted: boolean) => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const res = await confirmCustomerResponse(splitId, token, accepted);
        if (!res.ok) {
          setOutcome({ kind: "error", message: res.error });
          return;
        }
        const status = res.data.splitStatus;
        if (status === "confirmed") setOutcome({ kind: "confirmed" });
        else if (status === "cancelled") setOutcome({ kind: "cancelled" });
        else if (status === "stock_conflict") setOutcome({ kind: "stock_conflict" });
        else setOutcome({ kind: "error", message: `Stato inatteso: ${status}` });
      } catch (err) {
        setOutcome({
          kind: "error",
          message: err instanceof Error ? err.message : "Errore sconosciuto",
        });
      }
    });
  };

  if (outcome) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="mb-6">
          <Link
            href="/ordini"
            className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal"
          >
            <ArrowLeft className="h-4 w-4" /> Torna agli ordini
          </Link>
        </div>
        <OutcomeCard outcome={outcome} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-6">
        <Link
          href="/ordini"
          className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" /> Torna agli ordini
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">
          Conferma modifiche ordine
        </h1>
        <p className="text-sm text-sage mt-1">
          Ordine <span className="font-mono">#{shortId}</span> — fornitore{" "}
          <span className="font-semibold text-charcoal">{supplierName}</span>
        </p>
      </header>

      <Card className="mb-4">
        <div className="flex items-start gap-3 p-1">
          <AlertCircle className="h-5 w-5 text-terracotta shrink-0 mt-0.5" />
          <div className="text-sm text-charcoal leading-relaxed">
            Il fornitore ha proposto modifiche al tuo ordine. Controlla il
            riepilogo qui sotto e scegli se accettare le modifiche o annullare
            l&apos;intero ordine.
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-charcoal">Riepilogo righe</h2>
          <div className="flex gap-2 text-xs">
            {counts.accepted > 0 && (
              <Badge variant="success">{counts.accepted} ok</Badge>
            )}
            {counts.modified > 0 && (
              <Badge variant="warning">{counts.modified} modificate</Badge>
            )}
            {counts.rejected > 0 && (
              <Badge className="bg-red-100 text-red-700">
                {counts.rejected} rifiutate
              </Badge>
            )}
          </div>
        </div>
        <div>
          {lines.map((l) => (
            <LineRow key={l.id} line={l} />
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-sage">Totale originale</span>
            <span className="font-mono text-sage line-through">
              {formatCurrency(originalTotal)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span className="text-charcoal">Nuovo totale proposto</span>
            <span className="font-mono text-forest">
              {formatCurrency(newTotal)}
            </span>
          </div>
          {diff !== 0 && (
            <div className="flex justify-between text-xs pt-2 border-t border-sage-muted/20">
              <span className="text-sage">Variazione</span>
              <span
                className={`font-mono ${diff < 0 ? "text-forest" : "text-terracotta"}`}
              >
                {diff > 0 ? "+" : ""}
                {formatCurrency(diff)}
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          isLoading={isPending}
          disabled={isPending}
          onClick={() => submit(true)}
        >
          Accetta modifiche
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="flex-1"
          disabled={isPending}
          onClick={() => submit(false)}
        >
          Annulla ordine
        </Button>
      </div>

      <p className="text-xs text-sage text-center mt-6">
        Il link e&apos; valido per 48 ore dall&apos;invio dell&apos;email.
      </p>
    </div>
  );
}
