"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signInWithGoogle, signInWithMagicLink } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Mail, Lock } from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.19V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      toast(result.error);
      setIsLoading(false);
    } else if (result?.redirectTo) {
      router.push(result.redirectTo);
    }
  }

  async function handleMagicLink(formData: FormData) {
    setIsLoading(true);
    setError(null);
    const result = await signInWithMagicLink(formData);
    if (result?.message) {
      toast(result.message);
    }
    setIsLoading(false);
  }

  async function handleGoogleSignIn() {
    const result = await signInWithGoogle();
    if (result?.error) {
      toast(result.error);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-sage-muted)] bg-white p-7 shadow-[0_1px_2px_rgba(26,26,26,0.04),0_18px_48px_-20px_rgba(26,26,26,0.18)] sm:p-8">
      <div className="mb-7">
        <h2 className="font-display text-[27px] leading-tight text-charcoal">
          Bentornato
        </h2>
        <p className="mt-1.5 text-sm text-sage">
          Accedi al tuo account per continuare.
        </p>
      </div>

      {!showMagicLink ? (
        <form action={handleSubmit} className="space-y-4">
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
            placeholder="La tua password"
            prefix={<Lock className="h-4 w-4" />}
            required
            autoComplete="current-password"
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Accedi
          </Button>
        </form>
      ) : (
        <form action={handleMagicLink} className="space-y-4">
          <Input
            name="email"
            type="email"
            label="Email"
            placeholder="nome@azienda.it"
            prefix={<Mail className="h-4 w-4" />}
            required
            autoComplete="email"
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            <Mail className="h-4 w-4" />
            Invia Magic Link
          </Button>
        </form>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[color:var(--color-sage-muted)]" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-sage">
          oppure
        </span>
        <div className="h-px flex-1 bg-[color:var(--color-sage-muted)]" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[color:var(--color-sage-muted)] bg-white py-3.5 font-body font-semibold text-charcoal transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <GoogleIcon />
          Continua con Google
        </button>

        <Button
          variant="ghost"
          className="w-full text-sm"
          onClick={() => setShowMagicLink(!showMagicLink)}
        >
          {showMagicLink ? "Accedi con password" : "Accedi con Magic Link"}
        </Button>
      </div>

      <p className="mt-7 text-center text-sm text-sage">
        Non hai un account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand-primary hover:underline"
        >
          Registrati
        </Link>
      </p>
    </div>
  );
}
