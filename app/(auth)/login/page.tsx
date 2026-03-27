"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signInWithGoogle, signInWithMagicLink } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Mail } from "lucide-react";

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
    if (result?.error) {
      setError(result.error);
    }
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
    <Card>
      <CardContent>
        <h2 className="text-2xl font-bold text-charcoal mb-6 text-center">
          Accedi
        </h2>

        {!showMagicLink ? (
          <form action={handleSubmit} className="space-y-4">
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
              placeholder="La tua password"
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
          <div className="h-px flex-1 bg-sage-muted" />
          <span className="text-xs text-sage uppercase tracking-wider">
            oppure
          </span>
          <div className="h-px flex-1 bg-sage-muted" />
        </div>

        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            Continua con Google
          </Button>

          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setShowMagicLink(!showMagicLink)}
          >
            {showMagicLink
              ? "Accedi con password"
              : "Accedi con Magic Link"}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-sage">
          Non hai un account?{" "}
          <Link
            href="/signup"
            className="text-forest font-semibold hover:underline"
          >
            Registrati
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
