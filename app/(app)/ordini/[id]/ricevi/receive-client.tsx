"use client";

// Ricevi merce — fast mobile check-in at the delivery door: tick lines, adjust
// quantities, flag problems with photos, record lot / expiry / temperature for
// the traced categories (HACCP) and the DDT. Problems open a message to the
// supplier automatically (server side).

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  PackageCheck,
  Thermometer,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { KeypadModal } from "@/components/restaurant/ordering/qty-keypad";
import { compressImage } from "@/components/restaurant/ordering/compress-image";
import { cn, formatDate } from "@/lib/utils/formatters";
import { formatQty } from "@/lib/restaurants/ordering/types";
import { submitDeliveryCheck, uploadDeliveryPhoto } from "@/lib/restaurants/receiving/actions";
import {
  MACRO_CATEGORY_LABELS,
  isTraced,
  ruleLabel,
  temperatureOk,
  temperatureRule,
  type HaccpSettings,
} from "@/lib/restaurants/receiving/haccp";
import {
  ISSUE_LABELS,
  ISSUE_ORDER,
  type DeliveryIssue,
  type ReceivingBlock,
  type ReceivingLine,
} from "@/lib/restaurants/receiving/types";

type Photo = { path: string; preview: string };
type LineState = {
  issue: DeliveryIssue;
  receivedQty: number | null;
  note: string;
  photos: Photo[];
  lot: string;
  expiry: string;
  temp: string;
  open: boolean;
};
type BlockState = { ddtNumber: string; ddtPhoto: Photo | null };

function initialLine(): LineState {
  return { issue: "ok", receivedQty: null, note: "", photos: [], lot: "", expiry: "", temp: "", open: false };
}

function parseTemp(s: string): number | null {
  const v = Number(s.replace(",", "."));
  return s.trim() !== "" && Number.isFinite(v) ? v : null;
}

export function ReceiveClient({
  orderId,
  orderDate,
  cancelled,
  canReceive,
  blocks,
  settings,
  alreadyChecked,
}: {
  orderId: string;
  orderDate: string;
  cancelled: boolean;
  canReceive: boolean;
  blocks: ReceivingBlock[];
  settings: HaccpSettings;
  alreadyChecked: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [blockState, setBlockState] = useState<Record<string, BlockState>>({});
  const [notes, setNotes] = useState("");
  const [keypadFor, setKeypadFor] = useState<ReceivingLine | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const get = (ref: string) => lines[ref] ?? initialLine();
  const patch = (ref: string, p: Partial<LineState>) =>
    setLines((prev) => ({ ...prev, [ref]: { ...(prev[ref] ?? initialLine()), ...p } }));
  const bget = (key: string): BlockState => blockState[key] ?? { ddtNumber: "", ddtPhoto: null };
  const bpatch = (key: string, p: Partial<BlockState>) =>
    setBlockState((prev) => ({ ...prev, [key]: { ...bget(key), ...p } }));

  async function upload(file: File, slot: string): Promise<Photo | null> {
    setUploading(slot);
    try {
      const small = await compressImage(file);
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("file", small);
      const res = await uploadDeliveryPhoto(fd);
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      return { path: res.data.path, preview: URL.createObjectURL(small) };
    } finally {
      setUploading(null);
    }
  }

  function allOk(b: ReceivingBlock) {
    setLines((prev) => {
      const next = { ...prev };
      for (const l of b.lines) {
        const cur = next[l.ref] ?? initialLine();
        next[l.ref] = { ...cur, issue: "ok", receivedQty: null };
      }
      return next;
    });
    toast.success(`${b.supplierLabel}: tutto conforme`);
  }

  const traced = (l: ReceivingLine) => isTraced(l.name, l.category, settings);
  const issuesCount = blocks.reduce(
    (n, b) =>
      n +
      b.lines.filter((l) => {
        const s = get(l.ref);
        return s.issue !== "ok" || temperatureOk(l.category, parseTemp(s.temp), settings) === false;
      }).length,
    0,
  );
  const missingLots = blocks.reduce(
    (n, b) => n + b.lines.filter((l) => traced(l) && get(l.ref).issue !== "missing" && !get(l.ref).lot.trim()).length,
    0,
  );

  function submit() {
    if (settings.requireDdtPhoto && blocks.some((b) => !bget(b.key).ddtPhoto)) {
      toast.error("Scatta la foto del DDT per ogni fornitore");
      return;
    }
    startTransition(async () => {
      if (missingLots > 0) {
        const ok = await confirm({
          title: `${missingLots} prodott${missingLots === 1 ? "o" : "i"} senza lotto`,
          description:
            "Per la tracciabilità (Reg. CE 178/2002) conviene registrare il lotto di carne, pesce, latticini e uova. Registrare comunque?",
          confirmLabel: "Registra comunque",
          cancelLabel: "Aggiungo i lotti",
        });
        if (!ok) return;
      }
      const res = await submitDeliveryCheck({
        orderId,
        notes: notes.trim() || null,
        blocks: blocks.map((b) => ({
          splitId: b.splitId,
          supplierLabel: b.supplierLabel,
          ddtNumber: bget(b.key).ddtNumber.trim() || null,
          ddtPhotoPath: bget(b.key).ddtPhoto?.path ?? null,
          lines: b.lines.map((l) => {
            const s = get(l.ref);
            return {
              ref: l.ref,
              name: l.name,
              unit: l.unit,
              orderedQty: l.orderedQty,
              receivedQty: s.issue === "ok" ? l.orderedQty : s.receivedQty ?? (s.issue === "missing" ? 0 : l.orderedQty),
              issue: s.issue,
              note: s.note.trim() || null,
              photoPaths: s.photos.map((p) => p.path),
              category: l.category,
              lotNumber: s.lot.trim() || null,
              expiryDate: s.expiry || null,
              temperatureC: parseTemp(s.temp),
            };
          }),
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.issues > 0) {
        toast.warning(
          `Ricevimento registrato con ${res.data.issues} problem${res.data.issues === 1 ? "a" : "i"}${
            res.data.messagesSent > 0 ? " — fornitore avvisato in chat" : ""
          }`,
        );
      } else {
        toast.success("Ricevimento registrato: tutto conforme");
      }
      router.push(`/ordini/${orderId}`);
      router.refresh();
    });
  }

  return (
    <div className="px-1 pt-3 pb-4 lg:px-0 lg:pt-0">
      <Link
        href={`/ordini/${orderId}`}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[var(--f-muted)] hover:text-[var(--f-ink)]"
      >
        <ArrowLeft className="h-4 w-4" /> Torna all&apos;ordine
      </Link>
      <PageHeader
        title="Ricevi merce"
        subtitle={`Ordine #${orderId.slice(0, 8)} del ${formatDate(orderDate)} — spunta ciò che è arrivato, segnala i problemi e registra lotti e temperature.`}
      />

      {alreadyChecked && (
        <p className="mb-3 rounded-[12px] bg-[var(--f-info-bg)] px-3 py-2 text-[13px] text-[var(--f-info)]">
          Questo ordine ha già un ricevimento registrato: salvando ne aggiungi uno nuovo (resta lo storico).
        </p>
      )}

      {!canReceive || cancelled ? (
        <FCard>
          <CardEmpty>
            {cancelled ? "Ordine annullato." : "Il tuo ruolo non consente di registrare il ricevimento merce."}
          </CardEmpty>
        </FCard>
      ) : blocks.length === 0 ? (
        <FCard>
          <CardEmpty>Nessuna riga da controllare in questo ordine.</CardEmpty>
        </FCard>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {blocks.map((b, bi) => {
            const bs = bget(b.key);
            return (
              <FCard key={b.key} index={bi}>
                <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[17px] font-semibold text-[var(--f-ink)]">{b.supplierLabel}</h2>
                    <p className="text-[12px] text-[var(--f-muted)]">
                      {b.lines.length} righe
                      {b.canMessage ? " · i problemi vengono inviati al fornitore in chat" : ""}
                    </p>
                  </div>
                  <button type="button" className="f-btn f-btn-sm f-btn-soft" onClick={() => allOk(b)}>
                    <CheckCheck className="h-4 w-4" /> Tutto OK
                  </button>
                </header>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="f-input h-11 px-3"
                    placeholder="Numero DDT (opzionale)"
                    value={bs.ddtNumber}
                    maxLength={60}
                    onChange={(e) => bpatch(b.key, { ddtNumber: e.target.value })}
                    aria-label={`Numero DDT ${b.supplierLabel}`}
                  />
                  <PhotoButton
                    label={bs.ddtPhoto ? "DDT fotografato" : settings.requireDdtPhoto ? "Foto DDT (obbligatoria)" : "Foto DDT"}
                    icon={<FileText className="h-4 w-4" />}
                    busy={uploading === `ddt:${b.key}`}
                    done={!!bs.ddtPhoto}
                    onFile={async (f) => {
                      const p = await upload(f, `ddt:${b.key}`);
                      if (p) bpatch(b.key, { ddtPhoto: p });
                    }}
                  />
                </div>

                <ul className="divide-y divide-[var(--f-line)]">
                  {b.lines.map((l) => {
                    const s = get(l.ref);
                    const isTr = traced(l);
                    const rule = temperatureRule(l.category, settings);
                    const tOk = temperatureOk(l.category, parseTemp(s.temp), settings);
                    const expanded = s.open || s.issue !== "ok";
                    return (
                      <li key={l.ref} className="py-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => patch(l.ref, { issue: "ok", receivedQty: null, open: false })}
                            className={cn(
                              "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                              s.issue === "ok"
                                ? "border-[var(--f-success)] bg-[var(--f-success-bg)] text-[var(--f-success)]"
                                : "border-[var(--f-line-strong)] text-[var(--f-faint)]",
                            )}
                            aria-label={`${l.name}: conforme`}
                            aria-pressed={s.issue === "ok"}
                          >
                            <Check className="h-5 w-5" strokeWidth={2.6} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[15px] font-medium text-[var(--f-ink)]">{l.name}</span>
                              {isTr && (
                                <StatusPill tone="info">{MACRO_CATEGORY_LABELS[l.category]} · tracciato</StatusPill>
                              )}
                              {s.issue !== "ok" && <StatusPill tone="danger">{ISSUE_LABELS[s.issue]}</StatusPill>}
                              {tOk === false && (
                                <StatusPill tone="danger">
                                  <Thermometer className="h-3 w-3" /> fuori range
                                </StatusPill>
                              )}
                            </div>
                            <p className="text-[12.5px] text-[var(--f-muted)]">
                              Ordinati {l.orderedQty === null ? "—" : formatQty(l.orderedQty)} {l.unit ?? ""}
                              {s.issue !== "ok" && s.receivedQty !== null ? ` · ricevuti ${formatQty(s.receivedQty)}` : ""}
                            </p>
                            {!expanded && (
                              <button
                                type="button"
                                className="mt-1 text-[12.5px] font-medium text-[var(--acc-700)]"
                                onClick={() => patch(l.ref, { open: true })}
                              >
                                {isTr ? "Lotto, scadenza, temperatura · segnala problema" : "Segnala problema"}
                              </button>
                            )}
                          </div>
                        </div>

                        {(expanded || isTr) && (
                          <div className="mt-3 space-y-3 sm:pl-14">
                            {expanded && (
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo di problema">
                                {ISSUE_ORDER.map((iss) => (
                                  <button
                                    key={iss}
                                    type="button"
                                    onClick={() =>
                                      patch(l.ref, {
                                        issue: s.issue === iss ? "ok" : iss,
                                        receivedQty: iss === "missing" ? 0 : s.receivedQty ?? l.orderedQty,
                                        open: true,
                                      })
                                    }
                                    className={cn(
                                      "h-9 rounded-full border px-3 text-[13px] font-medium transition-colors",
                                      s.issue === iss
                                        ? "border-[var(--f-danger)] bg-[var(--f-danger-bg)] text-[var(--f-danger)]"
                                        : "border-[var(--f-line-strong)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill)]",
                                    )}
                                    aria-pressed={s.issue === iss}
                                  >
                                    {ISSUE_LABELS[iss]}
                                  </button>
                                ))}
                              </div>
                            )}

                            {s.issue !== "ok" && (
                              <div className="flex flex-wrap items-center gap-2">
                                {s.issue !== "missing" && (
                                  <button
                                    type="button"
                                    className="f-btn f-btn-sm f-btn-outline tabular-nums"
                                    onClick={() => setKeypadFor(l)}
                                  >
                                    Ricevuti: {s.receivedQty === null ? "—" : formatQty(s.receivedQty)} {l.unit ?? ""}
                                  </button>
                                )}
                                <PhotoButton
                                  label={s.photos.length > 0 ? `Foto (${s.photos.length})` : "Foto"}
                                  icon={<Camera className="h-4 w-4" />}
                                  busy={uploading === l.ref}
                                  done={false}
                                  small
                                  onFile={async (f) => {
                                    if (s.photos.length >= 6) return;
                                    const p = await upload(f, l.ref);
                                    if (p) patch(l.ref, { photos: [...get(l.ref).photos, p] });
                                  }}
                                />
                                <input
                                  className="f-input h-9 min-w-[180px] flex-1 px-3 text-[13px]"
                                  placeholder="Nota (es. cassa schiacciata)"
                                  maxLength={500}
                                  value={s.note}
                                  onChange={(e) => patch(l.ref, { note: e.target.value })}
                                />
                              </div>
                            )}
                            {s.photos.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {s.photos.map((p) => (
                                  <span key={p.path} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.preview} alt="" className="h-16 w-16 rounded-[10px] object-cover" />
                                    <button
                                      type="button"
                                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--f-ink)] text-white"
                                      onClick={() => patch(l.ref, { photos: s.photos.filter((x) => x.path !== p.path) })}
                                      aria-label="Rimuovi foto"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {isTr && s.issue !== "missing" && (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <label className="block">
                                  <span className="f-label mb-1 block">Lotto</span>
                                  <input
                                    className="f-input h-11 w-full px-3 uppercase"
                                    value={s.lot}
                                    maxLength={80}
                                    autoCapitalize="characters"
                                    placeholder="es. L24-1187"
                                    onChange={(e) => patch(l.ref, { lot: e.target.value })}
                                  />
                                </label>
                                <label className="block">
                                  <span className="f-label mb-1 block">Scadenza / TMC</span>
                                  <input
                                    type="date"
                                    className="f-input h-11 w-full px-3"
                                    value={s.expiry}
                                    onChange={(e) => patch(l.ref, { expiry: e.target.value })}
                                  />
                                </label>
                                {rule ? (
                                  <label className="block">
                                    <span className="f-label mb-1 block">
                                      Temperatura °C <span className="text-[var(--f-faint)]">({ruleLabel(rule)})</span>
                                    </span>
                                    <input
                                      inputMode="decimal"
                                      className={cn(
                                        "f-input h-11 w-full px-3 tabular-nums",
                                        tOk === false && "!border-[var(--f-danger)] !bg-[var(--f-danger-bg)]",
                                      )}
                                      value={s.temp}
                                      placeholder={rule.max !== undefined && rule.max !== null ? String(rule.max) : ""}
                                      onChange={(e) => patch(l.ref, { temp: e.target.value.replace(/[^0-9,.-]/g, "") })}
                                    />
                                    {tOk === false && (
                                      <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[var(--f-danger)]">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Fuori range: valuta il respingimento
                                      </span>
                                    )}
                                  </label>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </FCard>
            );
          })}

          <FCard index={blocks.length}>
            <label className="f-label mb-1.5 block" htmlFor="receive-notes">
              Note sulla consegna (opzionale)
            </label>
            <textarea
              id="receive-notes"
              className="f-input min-h-[72px] w-full px-3 py-2"
              maxLength={1000}
              placeholder="Es. consegna arrivata alle 9:40, autista gentile"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FCard>

          <div className="sticky bottom-[96px] z-30 lg:bottom-4">
            <div className="f-card flex items-center justify-between gap-3 px-4 py-3 shadow-[var(--f-shadow-pop)]">
              <div className="min-w-0 text-[13px] text-[var(--f-muted)]">
                {issuesCount > 0 ? (
                  <span className="font-medium text-[var(--f-danger)]">
                    {issuesCount} problem{issuesCount === 1 ? "a" : "i"} da segnalare
                  </span>
                ) : (
                  <span className="font-medium text-[var(--f-success)]">Tutto conforme</span>
                )}
                {missingLots > 0 ? <span className="block">{missingLots} lotti da inserire</span> : null}
              </div>
              <button type="button" className="f-btn f-btn-primary" onClick={submit} disabled={pending || uploading !== null}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Registra ricevimento
              </button>
            </div>
          </div>
        </div>
      )}

      <KeypadModal
        open={keypadFor !== null}
        title={keypadFor ? `Ricevuti · ${keypadFor.name}` : ""}
        subtitle={keypadFor?.unit ? `Unità: ${keypadFor.unit}` : undefined}
        initial={keypadFor ? get(keypadFor.ref).receivedQty ?? keypadFor.orderedQty ?? 0 : 0}
        onClose={() => setKeypadFor(null)}
        onConfirm={(v) => {
          if (keypadFor) patch(keypadFor.ref, { receivedQty: v });
          setKeypadFor(null);
        }}
      />
      {dialog}
    </div>
  );
}

function PhotoButton({
  label,
  icon,
  busy,
  done,
  small = false,
  onFile,
}: {
  label: string;
  icon: React.ReactNode;
  busy: boolean;
  done: boolean;
  small?: boolean;
  onFile: (f: File) => void | Promise<void>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={cn("f-btn", small ? "f-btn-sm" : "h-11", done ? "f-btn-soft" : "f-btn-outline")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : icon}
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
    </>
  );
}
