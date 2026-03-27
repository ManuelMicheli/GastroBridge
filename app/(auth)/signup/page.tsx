"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (!selectedRole) return;
    setIsLoading(true);
    setError(null);
    formData.set("role", selectedRole);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      toast(result.error);
      setIsLoading(false);
    } else if (result?.redirectTo) {
      toast("Account creato! Controlla la tua email per confermare.");
      router.push(result.redirectTo);
    }
  }

  return (
    <Card>
      <CardContent>
        <h2 className="text-2xl font-bold text-charcoal mb-6 text-center">
          Crea il tuo account
        </h2>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setSelectedRole("restaurant")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
              selectedRole === "restaurant"
                ? "border-forest bg-forest-light"
                : "border-sage-muted hover:border-sage"
            )}
          >
            <Store
              className={cn(
                "h-8 w-8",
                selectedRole === "restaurant"
                  ? "text-forest"
                  : "text-sage"
              )}
            />
            <span
              className={cn(
                "text-sm font-semibold",
                selectedRole === "restaurant"
                  ? "text-forest-dark"
                  : "text-charcoal"
              )}
            >
              Ristoratore
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole("supplier")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
              selectedRole === "supplier"
                ? "border-forest bg-forest-light"
                : "border-sage-muted hover:border-sage"
            )}
          >
            <Truck
              className={cn(
                "h-8 w-8",
                selectedRole === "supplier" ? "text-forest" : "text-sage"
              )}
            />
            <span
              className={cn(
                "text-sm font-semibold",
                selectedRole === "supplier"
                  ? "text-forest-dark"
                  : "text-charcoal"
              )}
            >
              Fornitore
            </span>
          </button>
        </div>

        {selectedRole && (
          <form action={handleSubmit} className="space-y-4">
            <Input
              name="companyName"
              type="text"
              label="Nome Azienda"
              placeholder={
                selectedRole === "restaurant"
                  ? "Es. Trattoria Da Mario"
                  : "Es. Alimentari Rossi S.r.l."
              }
              required
            />
            <Input
              name="email"
              type="email"
              label="Email"
              placeholder="nome@azienda.it"
              required
              autoComplete="email"
            />
            <Input
              name="password"
              type="password"
              label="Password"
              placeholder="Minimo 8 caratteri"
              required
              autoComplete="new-password"
              error={error ?? undefined}
            />
            <Input
              name="vatNumber"
              type="text"
              label="Partita IVA"
              placeholder="Es. 12345678901"
              helperText="Facoltativa, puoi aggiungerla dopo"
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Registrati come{" "}
              {selectedRole === "restaurant" ? "Ristoratore" : "Fornitore"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-sage">
          Hai gia un account?{" "}
          <Link
            href="/login"
            className="text-forest font-semibold hover:underline"
          >
            Accedi
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
