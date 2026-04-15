"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  UserCheck,
  Ban,
} from "lucide-react";
import {
  changeRole,
  deactivateMember,
  reactivateMember,
  revokeInvite,
} from "@/lib/supplier/staff/actions";
import type { Database, SupplierRole } from "@/types/database";

type MemberRow = Database["public"]["Tables"]["supplier_members"]["Row"];

type MemberWithProfile = MemberRow & {
  profile?: {
    id: string;
    company_name: string | null;
  } | null;
};

type Props = {
  supplierId: string;
  initialMembers: MemberWithProfile[];
};

const ROLE_OPTIONS: { value: SupplierRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "warehouse", label: "Magazzino" },
  { value: "driver", label: "Driver" },
];

const ROLE_LABEL: Record<SupplierRole, string> = {
  admin: "Admin",
  sales: "Sales",
  warehouse: "Magazzino",
  driver: "Driver",
};

function memberStatus(m: MemberWithProfile): {
  label: string;
  variant: "default" | "success" | "warning" | "info" | "outline";
  icon: React.ReactNode;
} {
  if (!m.is_active) {
    if (!m.accepted_at) {
      return {
        label: "Invito revocato",
        variant: "outline",
        icon: <Ban className="h-3 w-3 mr-1" />,
      };
    }
    return {
      label: "Disattivato",
      variant: "outline",
      icon: <XCircle className="h-3 w-3 mr-1" />,
    };
  }
  if (!m.accepted_at) {
    return {
      label: "Invitato",
      variant: "warning",
      icon: <Clock className="h-3 w-3 mr-1" />,
    };
  }
  return {
    label: "Attivo",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
  };
}

export function StaffClient({ supplierId: _supplierId, initialMembers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChangeRole = (m: MemberWithProfile, role: SupplierRole) => {
    if (role === m.role) return;
    startTransition(async () => {
      const res = await changeRole({ member_id: m.id, role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ruolo aggiornato a ${ROLE_LABEL[role]}`);
      router.refresh();
    });
  };

  const onDeactivate = (m: MemberWithProfile) => {
    if (!confirm(`Disattivare questo membro?`)) return;
    startTransition(async () => {
      const res = await deactivateMember(m.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Membro disattivato");
      router.refresh();
    });
  };

  const onReactivate = (m: MemberWithProfile) => {
    startTransition(async () => {
      const res = await reactivateMember(m.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Membro riattivato");
      router.refresh();
    });
  };

  const onRevoke = (m: MemberWithProfile) => {
    if (!confirm(`Revocare l'invito?`)) return;
    startTransition(async () => {
      const res = await revokeInvite(m.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Invito revocato");
      router.refresh();
    });
  };

  if (initialMembers.length === 0) {
    return (
      <Card className="text-center py-16">
        <Users className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage mb-4">Nessun membro ancora.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {initialMembers.map((m) => {
        const status = memberStatus(m);
        const displayName = m.profile?.company_name || m.profile_id;
        const isPendingInvite = m.is_active && !m.accepted_at;
        return (
          <Card key={m.id} className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-charcoal truncate">
                  {displayName}
                </h3>
                <Badge variant={status.variant} className="text-[10px]">
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-sage mt-1">
                Invitato:{" "}
                {new Date(m.invited_at).toLocaleDateString("it-IT")}
                {m.accepted_at
                  ? ` · Accettato: ${new Date(
                      m.accepted_at,
                    ).toLocaleDateString("it-IT")}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={m.role}
                onChange={(e) =>
                  onChangeRole(m, e.target.value as SupplierRole)
                }
                disabled={pending || !m.is_active}
                className="border-2 border-sage-muted rounded-lg py-1.5 px-3 text-sm font-body text-charcoal bg-white focus:border-forest focus:outline-none disabled:opacity-50"
                aria-label="Cambia ruolo"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {isPendingInvite && (
                <button
                  onClick={() => onRevoke(m)}
                  disabled={pending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600 disabled:opacity-40"
                  aria-label="Revoca invito"
                  title="Revoca invito"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}

              {m.is_active && !isPendingInvite && (
                <button
                  onClick={() => onDeactivate(m)}
                  disabled={pending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600 disabled:opacity-40"
                  aria-label="Disattiva membro"
                  title="Disattiva membro"
                >
                  <UserX className="h-4 w-4" />
                </button>
              )}

              {!m.is_active && m.accepted_at && (
                <button
                  onClick={() => onReactivate(m)}
                  disabled={pending}
                  className="p-1.5 rounded-lg hover:bg-accent-green/10 text-sage hover:text-accent-green disabled:opacity-40"
                  aria-label="Riattiva membro"
                  title="Riattiva membro"
                >
                  <UserCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
