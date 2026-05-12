"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { LargeTitle } from "@/components/ui/large-title";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Lock,
  ChevronLeft,
} from "lucide-react";

type Props = {
  email: string;
  emailVerified: boolean;
  lastSignInAt: string | null;
  enrolled: boolean;
  currentAal: string;
  nextAal: string;
  factorIds: string[];
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ enrolled }: { enrolled: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
        "font-mono text-[10px] uppercase tracking-[0.08em]",
        enrolled
          ? "bg-[color:var(--color-success-subtle,#E6F4EA)] text-[color:var(--color-success,#1E6B3E)]"
          : "bg-[color:var(--color-warning-subtle,#FFF4E5)] text-[color:var(--color-warning,#9A6210)]",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          enrolled ? "bg-[color:var(--color-success,#1E6B3E)]" : "bg-[color:var(--color-warning,#9A6210)]",
        ].join(" ")}
        aria-hidden
      />
      {enrolled ? "MFA attiva" : "MFA non attiva"}
    </span>
  );
}

export function SecurityClient({
  email,
  emailVerified,
  lastSignInAt,
  enrolled,
  currentAal,
  nextAal,
  factorIds,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // MFA state
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Password change
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Sessions
  const [sessBusy, setSessBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Enrollment fallito");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Challenge fallita");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      toast.error(vErr.message);
      return;
    }
    toast.success("MFA attivata");
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    router.refresh();
  }

  async function challengeExisting() {
    const fid = factorIds[0];
    if (!fid) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: fid });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Challenge fallita");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: fid,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      toast.error(vErr.message);
      return;
    }
    toast.success("Codice verificato (aal2 attivo)");
    setCode("");
    router.refresh();
  }

  async function unenroll() {
    const fid = factorIds[0];
    if (!fid) return;
    const ok = window.confirm("Disattivare MFA? Perderai il secondo fattore e l'accesso ad aree protette.");
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: fid });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MFA disattivata");
    router.refresh();
  }

  async function changePassword() {
    if (pw.length < 8) {
      toast.error("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Le due password non coincidono.");
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password aggiornata");
    setPw("");
    setPw2("");
  }

  async function signOutOthers() {
    const ok = window.confirm(
      "Disconnettere tutte le altre sessioni? Resterai connesso solo su questo dispositivo."
    );
    if (!ok) return;
    setSessBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSessBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Altre sessioni disconnesse");
  }

  const aalLine = (
    <>
      Sessione corrente <strong className="font-mono">{currentAal}</strong>
      {nextAal !== currentAal && (
        <>
          {" · "}Richiesto <strong className="font-mono">{nextAal}</strong>
        </>
      )}
    </>
  );

  // ---- MFA Section Body (shared) ----
  const mfaBody = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {enrolled ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-success,#1E6B3E)]" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-warning,#9A6210)]" />
        )}
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
            {enrolled ? "Secondo fattore configurato" : "Secondo fattore non configurato"}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--color-text-secondary)]">
            {enrolled
              ? "L'app authenticator (Authy, Google Authenticator, 1Password) genera un codice a 6 cifre per accedere ad aree protette."
              : "Aggiungi un secondo fattore (app authenticator come Authy, Google Authenticator, 1Password) per proteggere cassetto fiscale e finanze."}
          </p>
        </div>
      </div>

      {!enrolled && !qr && (
        <Button onClick={startEnroll} disabled={busy} size="sm">
          Attiva MFA
        </Button>
      )}

      {qr && (
        <div className="space-y-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-muted,#FAFAF8)] p-4">
          <p className="text-[13px] text-[color:var(--color-text-secondary)]">
            Scansiona il QR con la tua app authenticator, poi inserisci il codice a 6 cifre.
          </p>
          <div className="inline-block rounded-md border border-[color:var(--color-border-subtle)] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR MFA" width={180} height={180} />
          </div>
          {secret && (
            <p className="break-all font-mono text-[11px] text-[color:var(--color-text-tertiary)]">
              Codice manuale: <span className="rounded bg-white px-1.5 py-0.5">{secret}</span>
            </p>
          )}
          <div className="max-w-[220px]">
            <Input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              label="Codice (6 cifre)"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={verifyEnroll} disabled={busy || code.length !== 6} size="sm">
              Conferma
            </Button>
            <Button
              onClick={() => {
                setQr(null);
                setSecret(null);
                setFactorId(null);
                setCode("");
              }}
              variant="ghost"
              size="sm"
              disabled={busy}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}

      {enrolled && currentAal === "aal1" && nextAal === "aal2" && (
        <div className="space-y-3 rounded-lg border border-[color:var(--color-warning-border,#E8D5A8)] bg-[color:var(--color-warning-subtle,#FFF4E5)] p-4">
          <p className="text-[13px] text-[color:var(--color-text-primary)]">
            <strong>Eleva la sessione a aal2.</strong> Inserisci il codice dell&apos;app authenticator
            per sbloccare le aree protette.
          </p>
          <div className="max-w-[220px]">
            <Input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              label="Codice (6 cifre)"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button onClick={challengeExisting} disabled={busy || code.length !== 6} size="sm">
            Verifica
          </Button>
        </div>
      )}

      {enrolled && (
        <div>
          <Button onClick={unenroll} variant="ghost" size="sm" disabled={busy}>
            Disattiva MFA
          </Button>
        </div>
      )}
    </div>
  );

  // ---- Password body ----
  const passwordBody = (
    <div className="space-y-3">
      <p className="text-[13px] text-[color:var(--color-text-secondary)]">
        Minimo 8 caratteri. Cambiare la password disconnette automaticamente le altre sessioni.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <Input
          name="new-password"
          type="password"
          label="Nuova password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <Input
          name="confirm-password"
          type="password"
          label="Conferma password"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </div>
      <div>
        <Button
          onClick={changePassword}
          size="sm"
          disabled={pwBusy || pw.length < 8 || pw !== pw2}
          isLoading={pwBusy}
        >
          Aggiorna password
        </Button>
      </div>
    </div>
  );

  // ---- Email body ----
  const emailBody = (
    <div className="flex items-start gap-3">
      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-text-tertiary)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] text-[color:var(--color-text-primary)]">
          {email || "—"}
        </div>
        <div className="mt-0.5 text-[11px] text-[color:var(--color-text-secondary)]">
          {emailVerified ? (
            <span className="text-[color:var(--color-success,#1E6B3E)]">Email verificata</span>
          ) : (
            <span className="text-[color:var(--color-warning,#9A6210)]">
              Email non verificata - controlla la casella per il link di conferma
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Sessions body ----
  const sessionsBody = (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-text-tertiary)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
            Dispositivo corrente
          </div>
          <div className="mt-0.5 text-[11px] text-[color:var(--color-text-secondary)]">
            Ultimo accesso: <span className="font-mono">{formatRelative(lastSignInAt)}</span>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-[color:var(--color-text-secondary)]">
        Se sospetti un accesso non autorizzato, disconnetti tutte le altre sessioni e cambia la password.
      </p>
      <Button onClick={signOutOthers} variant="ghost" size="sm" disabled={sessBusy} isLoading={sessBusy}>
        Disconnetti altre sessioni
      </Button>
    </div>
  );

  // ---- Protected areas body ----
  const protectedBody = (
    <div className="flex items-start gap-3">
      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-text-tertiary)]" />
      <div>
        <p className="text-[13px] leading-relaxed text-[color:var(--color-text-secondary)]">
          Le sezioni <strong>Cassetto fiscale</strong> e <strong>Finanze</strong> richiedono MFA
          attiva (livello aal2). Senza un secondo fattore non potrai accedere ai dati di fatturato
          e ricevute.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ---------- Mobile ---------- */}
      <div className="lg:hidden pb-8">
        <div className="px-4 pt-2">
          <Link
            href="/impostazioni"
            className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Impostazioni
          </Link>
        </div>
        <LargeTitle
          eyebrow="Impostazioni · Account"
          title="Sicurezza"
          subtitle="Proteggi accesso e dati sensibili"
          actions={<StatusPill enrolled={enrolled} />}
        />

        <div className="mt-4 space-y-3 px-4">
          {/* Overview */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-tertiary)]">
              Stato account
            </div>
            <p className="mt-2 text-[12px] text-[color:var(--color-text-secondary)]">{aalLine}</p>
          </section>

          {/* MFA */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-primary)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Autenticazione MFA
            </div>
            {mfaBody}
          </section>

          {/* Password */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-primary)]">
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> Password
            </div>
            {passwordBody}
          </section>

          {/* Email */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-primary)]">
              <Mail className="h-3.5 w-3.5" aria-hidden /> Email account
            </div>
            {emailBody}
          </section>

          {/* Sessions */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-primary)]">
              <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden /> Sessioni attive
            </div>
            {sessionsBody}
          </section>

          {/* Protected areas */}
          <section className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-card)] p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-primary)]">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Aree protette
            </div>
            {protectedBody}
          </section>
        </div>
      </div>

      {/* ---------- Desktop ---------- */}
      <div className="hidden lg:block space-y-6">
        <PageHeader
          title="Sicurezza"
          subtitle="Gestisci secondo fattore, password, email e sessioni del tuo account."
          meta={<StatusPill enrolled={enrolled} />}
        />

        <SectionFrame
          label="Panoramica · Account"
          trailing={<span className="font-mono">{aalLine}</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-tertiary)]">
                MFA
              </div>
              <div className="mt-1 text-[14px] font-medium text-[color:var(--color-text-primary)]">
                {enrolled ? "Attiva" : "Non attiva"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-tertiary)]">
                Email
              </div>
              <div className="mt-1 truncate font-mono text-[13px] text-[color:var(--color-text-primary)]">
                {email || "—"}
              </div>
              <div className="text-[11px] text-[color:var(--color-text-secondary)]">
                {emailVerified ? "Verificata" : "Non verificata"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-tertiary)]">
                Ultimo accesso
              </div>
              <div className="mt-1 font-mono text-[13px] text-[color:var(--color-text-primary)]">
                {formatRelative(lastSignInAt)}
              </div>
            </div>
          </div>
        </SectionFrame>

        <SectionFrame label="Autenticazione a due fattori · MFA">
          {mfaBody}
        </SectionFrame>

        <SectionFrame label="Password · Account">{passwordBody}</SectionFrame>

        <SectionFrame label="Email account">{emailBody}</SectionFrame>

        <SectionFrame label="Sessioni attive">{sessionsBody}</SectionFrame>

        <SectionFrame label="Aree protette">{protectedBody}</SectionFrame>
      </div>
    </>
  );
}
