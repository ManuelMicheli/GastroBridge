"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Mail, RotateCcw, Send, ShieldCheck, UserMinus, UserPlus, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar, FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import {
  INVITABLE_RESTAURANT_ROLES,
  RESTAURANT_ROLE_DESCRIPTIONS,
  RESTAURANT_ROLE_LABELS,
} from "@/lib/restaurants/permissions";
import {
  changeRestaurantMemberRole,
  deactivateRestaurantMember,
  inviteRestaurantMember,
  reactivateRestaurantMember,
  revokeRestaurantInvite,
} from "@/lib/restaurants/team/actions";
import type { TeamMember, TeamMemberStatus } from "@/lib/restaurants/team/queries";
import type { RestaurantRole } from "@/types/database";
import { cn, formatDate } from "@/lib/utils/formatters";

const STATUS_META: Record<TeamMemberStatus, { label: string; tone: FTone }> = {
  active: { label: "Attivo", tone: "success" },
  invited: { label: "Invitato", tone: "warning" },
  disabled: { label: "Disattivato", tone: "neutral" },
};

export function TeamClient({
  restaurantName,
  members,
  switcher,
}: {
  restaurantName: string;
  members: TeamMember[];
  switcher: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const activeCount = members.filter((m) => m.status === "active").length;
  const invitedCount = members.filter((m) => m.status === "invited").length;

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Operazione non riuscita");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function onRoleChange(m: TeamMember, role: RestaurantRole) {
    if (!m.id || role === m.role) return;
    const id = m.id;
    run(id, () => changeRestaurantMemberRole({ member_id: id, role }), `Ruolo aggiornato: ${RESTAURANT_ROLE_LABELS[role]}`);
  }

  async function onDeactivate(m: TeamMember) {
    if (!m.id) return;
    const id = m.id;
    const ok = await confirm({
      title: `Disattivare ${m.name}?`,
      description: `Non potrà più accedere a ${restaurantName} finché non lo riattivi.`,
      confirmLabel: "Disattiva",
      tone: "danger",
    });
    if (ok) run(id, () => deactivateRestaurantMember(id), "Membro disattivato");
  }

  function onReactivate(m: TeamMember) {
    if (!m.id) return;
    const id = m.id;
    run(id, () => reactivateRestaurantMember(id), "Membro riattivato");
  }

  async function onRevoke(m: TeamMember) {
    if (!m.id) return;
    const id = m.id;
    const ok = await confirm({
      title: "Revocare l'invito?",
      description: `${m.email ?? m.name} non potrà più accettarlo.`,
      confirmLabel: "Revoca invito",
      tone: "danger",
    });
    if (ok) run(id, () => revokeRestaurantInvite(id), "Invito revocato");
  }

  function onResend(m: TeamMember) {
    if (!m.id || !m.email) return;
    const email = m.email;
    run(
      m.id,
      async () => {
        const res = await inviteRestaurantMember({ email, role: m.role });
        return res.ok ? { ok: true } : res;
      },
      "Invito inviato di nuovo",
    );
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Team"
        subtitle={`Chi lavora con te su ${restaurantName}: inviti, ruoli e accessi.`}
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> Invita membro
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <FCard
          index={0}
          title={`Membri · ${members.length}`}
          action={
            <span className="text-[12.5px] text-[var(--f-muted)] tabular-nums">
              {activeCount} attivi{invitedCount > 0 ? ` · ${invitedCount} in attesa` : ""}
            </span>
          }
          bodyClassName="-mx-1"
        >
          <ul className="flex flex-col divide-y divide-[var(--f-line)]">
            {members.map((m) => (
              <MemberRow
                key={m.id ?? m.profileId}
                member={m}
                busy={pending && busyId === m.id}
                disabled={pending}
                onRoleChange={(role) => onRoleChange(m, role)}
                onDeactivate={() => void onDeactivate(m)}
                onReactivate={() => onReactivate(m)}
                onRevoke={() => void onRevoke(m)}
                onResend={() => onResend(m)}
              />
            ))}
          </ul>
          {members.length <= 1 ? (
            <p className="mt-3 px-1 text-[13px] text-[var(--f-muted)]">
              Sei solo tu per ora. Invita chef e responsabili per far gestire loro ordini e ricevimento merce.
            </p>
          ) : null}
        </FCard>

        <FCard index={1} title="Ruoli e permessi" action={<ShieldCheck className="h-4 w-4 text-[var(--f-muted)]" aria-hidden />}>
          <dl className="grid gap-3 sm:grid-cols-2">
            {INVITABLE_RESTAURANT_ROLES.map((role) => (
              <div key={role} className="rounded-[14px] bg-[var(--f-fill)] px-3.5 py-3">
                <dt className="text-[13.5px] font-semibold text-[var(--f-ink)]">{RESTAURANT_ROLE_LABELS[role]}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug text-[var(--f-muted)]">
                  {RESTAURANT_ROLE_DESCRIPTIONS[role]}
                </dd>
              </div>
            ))}
          </dl>
        </FCard>

        {switcher}
      </div>

      <InviteModal
        open={inviteOpen}
        restaurantName={restaurantName}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />
      {dialog}
    </div>
  );
}

function MemberRow({
  member: m,
  busy,
  disabled,
  onRoleChange,
  onDeactivate,
  onReactivate,
  onRevoke,
  onResend,
}: {
  member: TeamMember;
  busy: boolean;
  disabled: boolean;
  onRoleChange: (role: RestaurantRole) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onRevoke: () => void;
  onResend: () => void;
}) {
  const status = STATUS_META[m.status];
  const editable = !m.isAccountOwner && !m.isSelf && !!m.id;
  const meta =
    m.status === "invited"
      ? m.inviteExpired
        ? "Invito scaduto"
        : m.invitedAt
          ? `Invitato il ${formatDate(m.invitedAt)}`
          : "Invito in attesa"
      : m.isAccountOwner
        ? "Titolare dell'account"
        : m.acceptedAt
          ? `Nel team dal ${formatDate(m.acceptedAt)}`
          : null;

  return (
    <li className={cn("flex flex-col gap-3 px-1 py-3.5 sm:flex-row sm:items-center", m.status === "disabled" && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name} size={40} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-[14.5px] font-medium text-[var(--f-ink)]">
            <span className="truncate">{m.name}</span>
            {m.isSelf ? <span className="f-tag bg-[var(--acc-50)] text-[var(--acc-700)]">Tu</span> : null}
          </p>
          <p className="truncate text-[12.5px] text-[var(--f-muted)]">
            {m.email ?? "—"}
            {meta ? <span aria-hidden> · </span> : null}
            {meta ? <span className={m.inviteExpired ? "text-[var(--f-danger)]" : undefined}>{meta}</span> : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
        {editable && m.status !== "disabled" ? (
          <label className="sr-only" htmlFor={`role-${m.id}`}>
            Ruolo di {m.name}
          </label>
        ) : null}
        {editable && m.status !== "disabled" ? (
          <select
            id={`role-${m.id}`}
            value={m.role}
            disabled={disabled}
            onChange={(e) => onRoleChange(e.target.value as RestaurantRole)}
            className="h-9 rounded-full border border-[var(--f-line-strong)] bg-[var(--f-card)] px-3 pr-8 text-[13px] font-medium text-[var(--f-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc-600)]/40 disabled:opacity-60"
          >
            {INVITABLE_RESTAURANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {RESTAURANT_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex h-9 items-center px-1 text-[13px] font-medium text-[var(--f-ink-2)]">
            {RESTAURANT_ROLE_LABELS[m.role]}
          </span>
        )}

        <StatusPill tone={m.inviteExpired ? "danger" : status.tone} dot>
          {m.inviteExpired ? "Scaduto" : status.label}
        </StatusPill>

        {editable ? (
          <div className="flex items-center gap-1.5">
            {m.status === "invited" ? (
              <>
                <Button size="sm" density="compact" variant="secondary" onClick={onResend} disabled={disabled} isLoading={busy}>
                  <Send className="h-3.5 w-3.5" aria-hidden /> Invia di nuovo
                </Button>
                <Button size="sm" density="compact" variant="ghost" onClick={onRevoke} disabled={disabled}>
                  <XCircle className="h-3.5 w-3.5" aria-hidden /> Revoca
                </Button>
              </>
            ) : m.status === "active" ? (
              <Button size="sm" density="compact" variant="ghost" onClick={onDeactivate} disabled={disabled} isLoading={busy}>
                <UserMinus className="h-3.5 w-3.5" aria-hidden /> Disattiva
              </Button>
            ) : (
              <Button size="sm" density="compact" variant="secondary" onClick={onReactivate} disabled={disabled} isLoading={busy}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Riattiva
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function InviteModal({
  open,
  restaurantName,
  onClose,
  onInvited,
}: {
  open: boolean;
  restaurantName: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RestaurantRole>("chef");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setError(null);
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteRestaurantMember({ email, role });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        res.data.emailSent
          ? `Invito inviato a ${email.trim()}`
          : `Invito creato: ${email.trim()} lo troverà accedendo a GastroBridge`,
      );
      setEmail("");
      setRole("chef");
      onInvited();
    });
  }

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size="sm"
      title="Invita un membro"
      description={`Riceverà un'email per unirsi a ${restaurantName}.`}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="nome@ristorante.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          prefix={<Mail className="h-4 w-4" aria-hidden />}
          error={error ?? undefined}
          required
        />

        <fieldset>
          <legend className="f-label mb-1.5">Ruolo</legend>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ruolo">
            {INVITABLE_RESTAURANT_ROLES.map((r) => {
              const active = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-[14px] border px-3.5 py-2.5 text-left transition-[border-color,box-shadow,background-color] duration-200",
                    active
                      ? "border-[var(--acc-700)] bg-[var(--acc-50)] shadow-[0_0_0_1px_var(--acc-700)]"
                      : "border-[var(--f-line-strong)] hover:border-[var(--f-ink-2)]",
                  )}
                >
                  <span className="block text-[13.5px] font-semibold text-[var(--f-ink)]">{RESTAURANT_ROLE_LABELS[r]}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--f-muted)]">
                    {RESTAURANT_ROLE_DESCRIPTIONS[r]}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <ModalActions className="mt-2">
          <Button type="button" variant="secondary" onClick={close} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" isLoading={pending} disabled={!email.trim()}>
            <Send className="h-4 w-4" aria-hidden /> Invia invito
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
