// app/(app)/cerca/_components/cheatsheet-overlay.tsx
"use client";

import { X } from "lucide-react";
import { KeyboardHint } from "./keyboard-hint";

const ROWS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘", "K"], label: "Focus ricerca" },
  { keys: ["/"], label: "Focus ricerca" },
  { keys: ["↓"], label: "Prossimo risultato" },
  { keys: ["↑"], label: "Precedente risultato" },
  { keys: ["Enter"], label: "Apri dettagli" },
  { keys: ["Esc"], label: "Chiudi dettagli / pulisci" },
  { keys: ["⌘", "A"], label: "Aggiungi a ordine tipico" },
  { keys: ["F"], label: "Filtri (mobile)" },
  { keys: ["?"], label: "Questo aiuto" },
];

export function CheatsheetOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Scorciatoie"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border-subtle bg-surface-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Scorciatoie
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {ROWS.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
              <KeyboardHint keys={r.keys} />
              <span className="text-text-secondary">{r.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
