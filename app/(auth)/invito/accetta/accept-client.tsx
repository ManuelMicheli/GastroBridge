"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Store, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTile } from "@/components/fernly/primitives";
import { createClient } from "@/lib/supabase/client";
import { checkPasswordSafe } from "@/app/(auth)/actions";
import { acceptRestaurantInvite, declineRestaurantInvite } from "@/lib/restaurants/team/actions";

export type PendingInvite = {
  id: string;
  restaurantName: string;
  roleLabel: string;
  expired: boolean;
};

export function AcceptInviteClient({
  email,
  invites,
  offerPassword,
}: {
  email: string;
  invites: PendingInvite[];
  offerPassword: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  async function savePassword(): Promise<boolean> {
    if (!offerPassword || pw.length === 0) return true;
    if (pw.length < 10) {
      setPwError("La password deve avere almeno 10 caratteri.");
      return false;
    }
    if (pw !== pw2) {
      setPwError("Le due password non coincidono.");
      return false;
    }
    const safe = await checkPasswordSafe(pw);
    if (!safe.ok) {
      setPwError(safe.error);
      return false;
    }
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) {
      setPwError(error.message);
      return false;
    }
    return true;
  }

  function accept(invite: PendingInvite) {
    setBusyId(invite.id);
    setPwError(null);
    startTransition(async () => {
      if (!(await savePassword())) {
        setBusyId(null);
        return;
      }
      const res = await acceptRestaurantInvite(invite.id);
      if (!res.ok) {
        setBusyId(null);
        toast.error(res.error);
        return;
      }
      toast.success(`Benvenuto in ${invite.restaurantName}`);
      router.push("/dashboard");
      router.refresh();
    });
  }

  function decline(invite: PendingInvite) {
    setBusyId(invite.id);
    startTransition(async () => {
      const res = await declineRestaurantInvite(invite.id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Invito rifiutato");
      router.refresh();
    });
  }

  if (invites.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">Nessun invito in attesa</h1>
        <p className="mt-2 text-[14px] text-[var(--f-muted)]">
          Non ci sono inviti da accettare per {email || "questo account"}. Se l&apos;hai già accettato, trovi il
          ristorante nella dashboard.
        </p>
        <ButtonLink href="/dashboard" className="mt-6">
          Vai alla dashboard
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--f-ink)]">
        {invites.length === 1 ? "Sei stato invitato" : "Hai degli inviti"}
      </h1>
      <p className="mt-2 text-[14px] text-[var(--f-muted)]">
        Accedi come <strong className="font-medium text-[var(--f-ink)]">{email}</strong>. Accetta per lavorare con il
        team del ristorante su GastroBridge.
      </p>

      {offerPassword ? (
        <div className="mt-6 rounded-[18px] bg-[var(--f-card)] p-4 shadow-[0_1px_2px_rgba(16,24,20,.04),0_8px_24px_rgba(16,24,20,.04)]">
          <p className="text-[14px] font-medium text-[var(--f-ink)]">Imposta una password</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">
            Facoltativa: senza password potrai accedere con il link via email.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Input
              type="password"
              name="new-password"
              label="Nuova password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              prefix={<Lock className="h-4 w-4" aria-hidden />}
            />
            <Input
              type="password"
              name="confirm-password"
              label="Conferma password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              prefix={<Lock className="h-4 w-4" aria-hidden />}
              error={pwError ?? undefined}
            />
          </div>
        </div>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="rounded-[18px] bg-[var(--f-card)] p-4 shadow-[0_1px_2px_rgba(16,24,20,.04),0_8px_24px_rgba(16,24,20,.04)]"
          >
            <div className="flex items-center gap-3">
              <IconTile seed={invite.id}>
                <Store className="h-4 w-4" aria-hidden />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--f-ink)]">{invite.restaurantName}</p>
                <p className="text-[12.5px] text-[var(--f-muted)]">
                  Ruolo: {invite.roleLabel}
                  {invite.expired ? <span className="text-[var(--f-danger)]"> · invito scaduto</span> : null}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => decline(invite)}
                disabled={pending}
              >
                <X className="h-4 w-4" aria-hidden /> Rifiuta
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => accept(invite)}
                disabled={pending || invite.expired}
                isLoading={pending && busyId === invite.id}
              >
                <Check className="h-4 w-4" aria-hidden /> Accetta invito
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
