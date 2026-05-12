"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ShieldCheck, ShieldAlert } from "lucide-react";

type Props = {
  enrolled: boolean;
  currentAal: string;
  nextAal: string;
  factorIds: string[];
};

export function SecurityClient({ enrolled, currentAal, nextAal, factorIds }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      toast(error?.message ?? "Enrollment fallito");
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
      toast(chErr?.message ?? "Challenge fallita");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      toast(vErr.message);
      return;
    }
    toast("MFA attivata");
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
      toast(chErr?.message ?? "Challenge fallita");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: fid,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      toast(vErr.message);
      return;
    }
    toast("Codice verificato (aal2 attivo)");
    setCode("");
    router.refresh();
  }

  async function unenroll() {
    const fid = factorIds[0];
    if (!fid) return;
    const ok = window.confirm("Disattivare MFA? Perderai il secondo fattore.");
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: fid });
    setBusy(false);
    if (error) {
      toast(error.message);
      return;
    }
    toast("MFA disattivata");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">Sicurezza account</h1>
        <p className="text-sage text-sm">
          Proteggi il tuo account con un secondo fattore (app authenticator come
          Authy, Google Authenticator, 1Password).
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-start gap-3 mb-4">
            {enrolled ? (
              <ShieldCheck className="h-6 w-6 text-forest shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-terracotta shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="font-semibold text-charcoal">
                {enrolled ? "MFA attiva" : "MFA non attiva"}
              </h2>
              <p className="text-xs text-sage">
                Sessione corrente: <strong>{currentAal}</strong> · Richiesto:{" "}
                <strong>{nextAal}</strong>
              </p>
            </div>
          </div>

          {!enrolled && !qr && (
            <Button onClick={startEnroll} disabled={busy}>
              Attiva MFA
            </Button>
          )}

          {qr && (
            <div className="space-y-3">
              <p className="text-sm text-sage">
                Scansiona questo QR con la tua app authenticator, poi inserisci
                il codice a 6 cifre.
              </p>
              <div className="bg-white p-3 inline-block rounded-lg border border-sage-muted">
                {/* DOMPurify-sanitized SVG returned by Supabase. Plain <img> with the
                    inline data URI is the recommended pattern from supabase-js docs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR MFA" width={180} height={180} />
              </div>
              {secret && (
                <p className="text-xs text-sage break-all">
                  Codice manuale: <code className="bg-cream px-1 rounded">{secret}</code>
                </p>
              )}
              <Input
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                label="Codice (6 cifre)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                Conferma
              </Button>
            </div>
          )}

          {enrolled && currentAal === "aal1" && nextAal === "aal2" && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-sage">
                Inserisci il codice della tua app per elevare la sessione a aal2.
              </p>
              <Input
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                label="Codice (6 cifre)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button onClick={challengeExisting} disabled={busy || code.length !== 6}>
                Verifica
              </Button>
            </div>
          )}

          {enrolled && (
            <div className="mt-4">
              <Button onClick={unenroll} variant="ghost" disabled={busy}>
                Disattiva MFA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="font-semibold text-charcoal mb-2">Aree protette</h3>
          <p className="text-sm text-sage">
            Le sezioni <strong>Cassetto fiscale</strong> e <strong>Finanze</strong>{" "}
            richiedono MFA attiva (aal2). Senza un secondo fattore non potrai
            accedere ai dati di fatturato e ricevute.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
