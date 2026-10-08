"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, FileText, ImageIcon, Sheet, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

const ACCEPT =
  ".csv,.tsv,.xlsx,.xlsm,.xls,.pdf,.txt,.eml,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*,application/pdf,text/plain,text/csv";

type Props = {
  title?: string;
  hint?: string;
  placeholder?: string;
  onFile: (file: File) => void;
  onText: (text: string) => void;
  disabled?: boolean;
};

/**
 * One place to drop anything: a file, a photo (camera on phones), or text
 * pasted from an e-mail / WhatsApp. Ctrl+V of a screenshot works too.
 */
export function SmartDropzone({
  title = "Trascina il listino, una foto, un Excel o incolla il messaggio del fornitore",
  hint = "PDF, Excel, CSV, foto del listino cartaceo, testo di e-mail o WhatsApp: ci pensiamo noi a capire prodotti, prezzi e unità.",
  placeholder = "Es. «Rossi ortofrutta, consegna lun-gio, minimo 100€, pomodori datterini 3,20€/kg, zucchine 1,80 al kg…»",
  onFile,
  onText,
  disabled,
}: Props) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const pickFirst = useCallback(
    (files: FileList | null | undefined) => {
      const f = files?.[0];
      if (f && !disabled) onFile(f);
    },
    [onFile, disabled],
  );

  // Paste a screenshot / file anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        pickFirst(files);
        return;
      }
      const t = e.clipboardData?.getData("text/plain");
      if (t && t.trim().length > 10) {
        e.preventDefault();
        setText(t);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pickFirst]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div
        role="button"
        tabIndex={0}
        aria-label="Carica un file"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pickFirst(e.dataTransfer.files);
        }}
        className={cn(
          "f-card group flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
          drag
            ? "border-[var(--acc-600)] bg-[var(--acc-50)]"
            : "border-[var(--f-line-strong)] hover:border-[color:color-mix(in_oklab,var(--acc-600)_50%,transparent)]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--acc-50)] text-[var(--acc-700)]">
          <UploadCloud className="h-7 w-7" />
        </span>
        <p className="max-w-md text-[16px] font-semibold tracking-[-0.01em] text-[var(--f-ink)]">{title}</p>
        <p className="max-w-md text-[13px] text-[var(--f-muted)]">{hint}</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[12px] text-[var(--f-muted)]">
          <span className="f-tag bg-[var(--f-fill)]"><FileText className="h-3.5 w-3.5" /> PDF</span>
          <span className="f-tag bg-[var(--f-fill)]"><Sheet className="h-3.5 w-3.5" /> Excel / CSV</span>
          <span className="f-tag bg-[var(--f-fill)]"><ImageIcon className="h-3.5 w-3.5" /> Foto</span>
          <span className="f-tag bg-[var(--f-fill)]"><ClipboardPaste className="h-3.5 w-3.5" /> Testo</span>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" className="f-btn f-btn-primary f-btn-sm" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
            <UploadCloud className="h-4 w-4" /> Scegli un file
          </button>
          <button type="button" className="f-btn f-btn-outline f-btn-sm sm:hidden" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}>
            <Camera className="h-4 w-4" /> Scatta una foto
          </button>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pickFirst(e.target.files); e.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pickFirst(e.target.files); e.target.value = ""; }} />
      </div>

      <form
        className="f-card flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onText(text);
        }}
      >
        <label htmlFor="smart-import-text" className="flex items-center gap-2 text-[14px] font-medium text-[var(--f-ink)]">
          <ClipboardPaste className="h-4 w-4 text-[var(--acc-700)]" /> Oppure incolla il testo
        </label>
        <textarea
          id="smart-import-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={9}
          disabled={disabled}
          className="f-input min-h-[180px] flex-1 resize-y py-3 leading-relaxed"
          style={{ height: "auto" }}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[var(--f-faint)]">Anche messaggi WhatsApp copiati o e-mail intere.</span>
          <button type="submit" className="f-btn f-btn-primary f-btn-sm" disabled={disabled || !text.trim()}>
            <Sparkles className="h-4 w-4" /> Analizza
          </button>
        </div>
      </form>
    </div>
  );
}

export function ImportProgress({ progress, message, label }: { progress: number; message: string; label?: string | null }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="f-card flex flex-col items-center gap-4 px-6 py-12 text-center" role="status" aria-live="polite">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--acc-50)] text-[var(--acc-700)]">
        <Sparkles className="h-7 w-7 animate-pulse" />
      </span>
      <div>
        <p className="text-[16px] font-semibold text-[var(--f-ink)]">Stiamo leggendo {label ? `«${label}»` : "il documento"}…</p>
        <p className="mt-1 text-[13px] text-[var(--f-muted)]">{message || "Un attimo"}</p>
      </div>
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[var(--f-fill-2)]" aria-hidden>
        <div className="h-full rounded-full bg-[var(--acc-600)] transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <p className="text-[12px] tabular-nums text-[var(--f-faint)]">{pct}%</p>
    </div>
  );
}
