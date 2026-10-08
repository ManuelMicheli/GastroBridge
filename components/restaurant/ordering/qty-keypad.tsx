"use client";

// Kitchen-friendly quantity input: big −/+ targets (44 px), tap the number to
// open a numeric keypad (no tiny native inputs with wet hands at 1 am).

import { useEffect, useState } from "react";
import { Delete, Minus, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/formatters";
import { formatQty } from "@/lib/restaurants/ordering/types";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"] as const;

export function KeypadModal({
  open,
  title,
  subtitle,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  initial: number;
  onClose: () => void;
  onConfirm: (value: number) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText(initial > 0 ? formatQty(initial).replace(/\./g, "") : "");
  }, [open, initial]);

  function press(k: (typeof KEYS)[number]) {
    setText((t) => {
      if (k === "del") return t.slice(0, -1);
      if (k === ",") return t.includes(",") ? t : (t || "0") + ",";
      if (t.replace(",", "").length >= 6) return t;
      if (t === "0") return k;
      return t + k;
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function submit() {
    const v = Number((text || "0").replace(",", "."));
    onConfirm(Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : 0);
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title} description={subtitle} size="sm">
      <div
        className="mb-4 flex h-16 items-center justify-end rounded-[14px] bg-[var(--f-fill)] px-4 text-[34px] font-semibold tabular-nums text-[var(--f-ink)]"
        aria-live="polite"
      >
        {text || "0"}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="flex h-14 items-center justify-center rounded-[14px] border border-[var(--f-line)] bg-[var(--f-card)] text-[22px] font-medium text-[var(--f-ink)] transition-colors active:bg-[var(--acc-50)] hover:bg-[var(--f-fill)]"
            aria-label={k === "del" ? "Cancella" : k === "," ? "Virgola" : k}
          >
            {k === "del" ? <Delete className="h-5 w-5" /> : k}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="f-btn f-btn-outline f-btn-lg" onClick={() => onConfirm(0)}>
          Azzera
        </button>
        <button type="button" data-autofocus className="f-btn f-btn-primary f-btn-lg" onClick={submit}>
          Conferma
        </button>
      </div>
    </Modal>
  );
}

export function QtyStepper({
  value,
  onChange,
  onOpenKeypad,
  step = 1,
  disabled = false,
  unit,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  onOpenKeypad?: () => void;
  step?: number;
  disabled?: boolean;
  unit?: string;
  size?: "md" | "sm";
}) {
  const h = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={cn("inline-flex items-center gap-1", disabled && "opacity-50")}>
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, Math.round((value - step) * 1000) / 1000))}
        className={cn(
          h,
          "flex items-center justify-center rounded-full border border-[var(--f-line-strong)] text-[var(--f-ink)] transition-colors hover:bg-[var(--f-fill)] disabled:opacity-40",
        )}
        aria-label="Diminuisci"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpenKeypad}
        className={cn(
          "min-w-[64px] rounded-[12px] px-2 text-center tabular-nums transition-colors",
          size === "sm" ? "h-9 text-[15px]" : "h-11 text-[17px]",
          value > 0
            ? "bg-[var(--acc-50)] font-semibold text-[var(--acc-ink)]"
            : "bg-[var(--f-fill)] text-[var(--f-faint)]",
        )}
        aria-label={`Quantità ${formatQty(value)}${unit ? ` ${unit}` : ""}, tocca per digitare`}
      >
        {formatQty(value)}
        {unit ? <span className="ml-1 text-[11px] font-normal text-[var(--f-muted)]">{unit}</span> : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.round((value + step) * 1000) / 1000)}
        className={cn(
          h,
          "flex items-center justify-center rounded-full bg-[var(--acc-800)] text-white transition-transform hover:scale-105 disabled:opacity-40",
        )}
        aria-label="Aumenta"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
