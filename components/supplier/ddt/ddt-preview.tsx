"use client";

// Task 9 (Plan 1D) — Anteprima DDT con azioni client-side.
//
// Azioni:
//   - Download originale (usa il signed URL embed o rigenera via action)
//   - Ristampa COPIA (watermark)
//   - Annulla DDT (admin only, modal motivo)
//   - Link alla consegna di provenienza
//
// Nota: il signedUrl embed scade dopo 5 min → se l'utente lascia aperto e
// riclicca "Download", chiamiamo `getDdtSignedUrl` per rigenerarlo.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Download, Copy, Ban, Truck } from "lucide-react";
import {
  getDdtSignedUrl,
  generateCopyDdt,
  cancelDdt,
} from "@/lib/supplier/ddt/actions";

type LineItem = {
  id: string;
  product_name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  lot_code: string | null;
  expiry_date: string | null;
};

type Props = {
  ddtId: string;
  deliveryId: string;
  signedUrl: string | null;
  canAdmin: boolean;
  canCancel: boolean;
  lines: LineItem[];
};

export function DdtPreview({
  ddtId,
  deliveryId,
  signedUrl,
  canAdmin,
  canCancel,
  lines,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const onDownload = () => {
    startTransition(async () => {
      const res = await getDdtSignedUrl(ddtId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.pdfUrl, "_blank", "noopener,noreferrer");
    });
  };

  const onCopy = () => {
    startTransition(async () => {
      const res = await generateCopyDdt(ddtId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Copia generata");
      window.open(res.pdfUrl, "_blank", "noopener,noreferrer");
    });
  };

  const confirmCancel = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("Motivo obbligatorio (min. 3 caratteri)");
      return;
    }
    startTransition(async () => {
      const res = await cancelDdt(ddtId, trimmed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `DDT annullato. Storno n. ${res.cancelNumber}/${res.cancelYear}`,
      );
      setCancelOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={onDownload}
            disabled={pending}
          >
            <Download className="h-4 w-4" /> Download originale
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onCopy}
            disabled={pending}
          >
            <Copy className="h-4 w-4" /> Ristampa COPIA
          </Button>
          <Link href={`/supplier/consegne/${deliveryId}`}>
            <Button size="sm" variant="ghost" type="button">
              <Truck className="h-4 w-4" /> Vai alla consegna
            </Button>
          </Link>
          {canAdmin && canCancel && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setCancelOpen(true)}
              disabled={pending}
              className="ml-auto text-red-600 hover:bg-red-50"
            >
              <Ban className="h-4 w-4" /> Annulla DDT
            </Button>
          )}
        </div>
      </Card>

      {lines.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-sage-muted/30">
            <h2 className="font-bold text-charcoal">Righe DDT</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sage-muted/20 text-left text-xs uppercase tracking-wider text-sage">
                <tr>
                  <th className="px-4 py-2 w-10">#</th>
                  <th className="px-4 py-2">Prodotto</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2 text-right">Qtà</th>
                  <th className="px-4 py-2">Lotto</th>
                  <th className="px-4 py-2">Scadenza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-muted/30">
                {lines.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-sage">{idx + 1}</td>
                    <td className="px-4 py-2 text-charcoal">
                      {r.product_name}
                    </td>
                    <td className="px-4 py-2 text-sage">{r.sku ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-charcoal">
                      {r.quantity} {r.unit}
                    </td>
                    <td className="px-4 py-2 text-sage">
                      {r.lot_code ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sage">
                      {r.expiry_date
                        ? new Date(r.expiry_date).toLocaleDateString("it-IT")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sage-muted/30">
          <h2 className="font-bold text-charcoal">Anteprima PDF</h2>
        </div>
        {signedUrl ? (
          <iframe
            src={signedUrl}
            className="w-full h-[70vh] border-0"
            title="Anteprima DDT"
          />
        ) : (
          <div className="px-4 py-16 text-center text-sage">
            Anteprima PDF non disponibile.
          </div>
        )}
      </Card>

      <Modal
        isOpen={cancelOpen}
        onClose={() => {
          if (!pending) {
            setCancelOpen(false);
            setReason("");
          }
        }}
        title="Annulla DDT"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-sage">
            L&apos;annullamento è irreversibile: verrà emesso un DDT di storno
            con nuovo progressivo e causale &quot;storno&quot;.
          </p>
          <label className="block text-xs text-sage">
            Motivo annullamento
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={pending}
              placeholder="Es. errore su destinatario"
              className="mt-1 w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCancelOpen(false);
                setReason("");
              }}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={confirmCancel}
              disabled={pending || reason.trim().length < 3}
            >
              Conferma annullamento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
