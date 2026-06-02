"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Store, Truck, Mail, Lock, Building2, Hash } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { SUPPLIER_PLATFORM_ENABLED } from "@/lib/utils/constants";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!selectedRole) return;
    setIsLoading(true);
    setError(null);
    setEmailExists(false);
    formData.set("role", selectedRole);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setEmailExists(Boolean(result.emailExists));
      toast(result.error);
      setIsLoading(false);
    } else if (result?.redirectTo) {
      toast("Account creato! Controlla la tua email per confermare.");
      router.push(result.redirectTo);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-sage-muted)] bg-white p-7 shadow-[0_1px_2px_rgba(26,26,26,0.04),0_18px_48px_-20px_rgba(26,26,26,0.18)] sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-[27px] leading-tight text-charcoal">
          Crea il tuo account
        </h2>
        <p className="mt-1.5 text-sm text-sage">
          Scegli il tuo profilo per iniziare.
        </p>
      </div>

      {/* Role selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSelectedRole("restaurant")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
            selectedRole === "restaurant"
              ? "border-brand-primary bg-brand-primary-subtle"
              : "border-[color:var(--color-sage-muted)] hover:border-sage",
          )}
        >
          <Store
            className={cn(
              "h-7 w-7",
              selectedRole === "restaurant"
                ? "text-brand-primary"
                : "text-sage",
            )}
          />
          <span
            className={cn(
              "text-sm font-semibold",
              selectedRole === "restaurant"
                ? "text-brand-depth"
                : "text-charcoal",
            )}
          >
            Ristoratore
          </span>
        </button>

        <button
          type="button"
          disabled={!SUPPLIER_PLATFORM_ENABLED}
          aria-disabled={!SUPPLIER_PLATFORM_ENABLED}
          onClick={() => {
            if (SUPPLIER_PLATFORM_ENABLED) setSelectedRole("supplier");
          }}
          title={
            SUPPLIER_PLATFORM_ENABLED
              ? undefined
              : "La registrazione fornitori arriverà nella versione 2"
          }
          className={cn(
            "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
            !SUPPLIER_PLATFORM_ENABLED
              ? "cursor-not-allowed border-[color:var(--color-sage-muted)] opacity-60"
              : selectedRole === "supplier"
                ? "border-brand-primary bg-brand-primary-subtle"
                : "border-[color:var(--color-sage-muted)] hover:border-sage",
          )}
        >
          {!SUPPLIER_PLATFORM_ENABLED && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-[color:var(--color-sage-muted)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-charcoal">
              Presto
            </span>
          )}
          <Truck
            className={cn(
              "h-7 w-7",
              selectedRole === "supplier" ? "text-brand-primary" : "text-sage",
            )}
          />
          <span
            className={cn(
              "text-sm font-semibold",
              selectedRole === "supplier" ? "text-brand-depth" : "text-charcoal",
            )}
          >
            Fornitore
          </span>
        </button>
      </div>

      {selectedRole && (
        <form action={handleSubmit} className="mt-6 space-y-4">
          <Input
            name="companyName"
            type="text"
            label="Nome Azienda"
            placeholder={
              selectedRole === "restaurant"
                ? "Es. Trattoria Da Mario"
                : "Es. Alimentari Rossi S.r.l."
            }
            prefix={<Building2 className="h-4 w-4" />}
            required
          />
          <Input
            name="email"
            type="email"
            label="Email"
            placeholder="nome@azienda.it"
            prefix={<Mail className="h-4 w-4" />}
            required
            autoComplete="email"
          />
          <Input
            name="password"
            type="password"
            label="Password"
            placeholder="Minimo 8 caratteri"
            prefix={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            error={error ?? undefined}
          />
          <Input
            name="vatNumber"
            type="text"
            label="Partita IVA"
            placeholder="Es. 12345678901"
            prefix={<Hash className="h-4 w-4" />}
            helperText="Facoltativa, puoi aggiungerla dopo"
          />

          {emailExists && (
            <div
              role="alert"
              className="rounded-xl border border-brand-primary/30 bg-brand-primary-subtle p-3.5"
            >
              <p className="text-sm font-medium text-brand-depth">
                Questa email è già collegata a un account.
              </p>
              <Link
                href="/login"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
              >
                Accedi al tuo account
                <span aria-hidden>{"→"}</span>
              </Link>
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Registrati come{" "}
            {selectedRole === "restaurant" ? "Ristoratore" : "Fornitore"}
          </Button>
        </form>
      )}

      <p className="mt-7 text-center text-sm text-sage">
        Hai già un account?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-primary hover:underline"
        >
          Accedi
        </Link>
      </p>
    </div>
  );
}
