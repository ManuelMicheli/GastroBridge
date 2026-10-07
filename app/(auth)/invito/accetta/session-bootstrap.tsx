"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ButtonLink } from "@/components/ui/button";

const LOGIN_URL = `/login?redirect=${encodeURIComponent("/invito/accetta")}`;

/**
 * The Supabase invite email redirects here with the new session in the URL
 * fragment (#access_token=…&refresh_token=…). Store it and reload the page as
 * a signed-in user; without tokens, go to the login page and come back.
 */
export function InviteSessionBootstrap() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hashError = hash.get("error_description") ?? hash.get("error");

    if (hashError) {
      setError(hashError.replace(/\+/g, " "));
      return;
    }
    if (!accessToken || !refreshToken) {
      router.replace(LOGIN_URL);
      return;
    }

    const supabase = createClient();
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        // Drop the tokens from the address bar before re-rendering.
        window.history.replaceState(null, "", window.location.pathname);
        router.refresh();
      });
  }, [router]);

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">Link non valido</h1>
        <p className="mt-2 text-[14px] text-[var(--f-muted)]">
          Il link dell&apos;invito è scaduto o è già stato usato ({error}). Accedi per vedere i tuoi inviti.
        </p>
        <ButtonLink href={LOGIN_URL} className="mt-6">
          Accedi
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--f-muted)]" aria-hidden />
      <p className="text-[14px] text-[var(--f-muted)]">Apertura dell&apos;invito…</p>
    </div>
  );
}
