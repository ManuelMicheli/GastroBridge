"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createPriceList } from "@/lib/supplier/pricing/actions";

type Props = {
  supplierId: string;
};

export function NuovoListinoForm({ supplierId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validTo, setValidTo] = useState<string>("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Nome obbligatorio");
      return;
    }
    startTransition(async () => {
      const res = await createPriceList(supplierId, {
        name: trimmed,
        description: description.trim() || null,
        valid_from: validFrom || null,
        valid_to: validTo || null,
        is_default: isDefault,
        is_active: isActive,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Listino creato");
      router.push(`/supplier/listini/${res.data.id}`);
    });
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-6 space-y-4">
      <label className="block">
        <span className="text-sm text-text-secondary">Nome *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          placeholder="Es. Listino Estate 2026"
        />
      </label>

      <label className="block">
        <span className="text-sm text-text-secondary">Descrizione</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          placeholder="Note interne"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-text-secondary">Valido dal</span>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
        </label>
        <label className="block">
          <span className="text-sm text-text-secondary">Valido fino al</span>
          <input
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-text-secondary">
            Imposta come predefinito
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-text-secondary">Attivo</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href="/supplier/listini"
          className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
        >
          Annulla
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
        >
          {pending ? "Creo..." : "Crea listino"}
        </button>
      </div>
    </div>
  );
}
