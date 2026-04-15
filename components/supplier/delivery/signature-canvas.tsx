"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Check } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void | Promise<void>;
  confirming?: boolean;
};

/**
 * Fullscreen sheet con canvas `signature_pad`.
 *
 * - touch + mouse handled dalla libreria.
 * - DPR scaling applicato tramite ratio resize.
 * - Export `toDataURL('image/png')` (base64).
 *
 * Tap target dei bottoni ≥ 44px (h-12).
 */
export function SignatureCanvas({ open, onClose, onConfirm, confirming }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [empty, setEmpty] = useState(true);

  // Setup / teardown SignaturePad quando apriamo il foglio
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      ctx?.scale(ratio, ratio);
      padRef.current?.clear();
      setEmpty(true);
    };

    padRef.current = new SignaturePad(canvas, {
      penColor: "#111827",
      backgroundColor: "#ffffff",
      minWidth: 0.8,
      maxWidth: 2.4,
    });
    padRef.current.addEventListener("endStroke", () => {
      setEmpty(padRef.current?.isEmpty() ?? true);
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      padRef.current?.off();
      padRef.current = null;
    };
  }, [open]);

  // Blocca scroll body quando aperto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleClear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const handleConfirm = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.toDataURL("image/png");
    await onConfirm(dataUrl);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cattura firma"
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <header className="flex items-center justify-between border-b border-sage-muted/40 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-charcoal hover:bg-sage-muted/30"
          aria-label="Annulla firma"
        >
          <X className="h-5 w-5" /> Annulla
        </button>
        <p className="text-sm font-semibold text-charcoal">Firma del ricevente</p>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-sage hover:bg-sage-muted/30"
          aria-label="Pulisci firma"
        >
          <RotateCcw className="h-5 w-5" /> Pulisci
        </button>
      </header>

      <div className="relative flex-1 touch-none">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ touchAction: "none" }}
        />
        {empty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-base italic text-sage-muted">
            Firma qui usando il dito o una penna
          </p>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-sage-muted/40 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="secondary"
          className="h-12 flex-1"
          onClick={onClose}
        >
          Annulla
        </Button>
        <Button
          type="button"
          variant="primary"
          className="h-12 flex-1"
          onClick={handleConfirm}
          disabled={empty || !!confirming}
        >
          <Check className="mr-2 h-5 w-5" />
          {confirming ? "Invio…" : "Conferma"}
        </Button>
      </footer>
    </div>
  );
}
