"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { inviteMember } from "@/lib/supplier/staff/actions";
import type { SupplierRole } from "@/types/database";

const ROLE_OPTIONS: { value: SupplierRole; label: string }[] = [
  { value: "sales", label: "Sales — gestisce clienti e listini" },
  { value: "warehouse", label: "Magazzino — gestisce catalogo e stock" },
  { value: "driver", label: "Driver — consegne e logistica" },
  { value: "admin", label: "Admin — accesso completo" },
];

export function InviteForm({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SupplierRole>("sales");
  const [errors, setErrors] = useState<{ email?: string }>({});

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrors({ email: "Email obbligatoria" });
      return;
    }

    startTransition(async () => {
      const res = await inviteMember(supplierId, { email: trimmed, role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invito inviato a ${trimmed}`);
      router.push("/supplier/staff");
      router.refresh();
    });
  };

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@azienda.it"
          autoComplete="email"
          required
          disabled={pending}
          error={errors.email}
        />
        <Select
          label="Ruolo"
          value={role}
          onChange={(e) => setRole(e.target.value as SupplierRole)}
          options={ROLE_OPTIONS}
          disabled={pending}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/supplier/staff")}
            disabled={pending}
          >
            Annulla
          </Button>
          <Button type="submit" size="sm" isLoading={pending}>
            <Send className="h-4 w-4" /> Invia invito
          </Button>
        </div>
      </form>
    </Card>
  );
}
