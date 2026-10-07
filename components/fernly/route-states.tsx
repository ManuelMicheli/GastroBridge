// Shared loading / error / not-found views for the logged-in areas
// (restaurant `app/(app)` and supplier `app/(supplier)`), rendered inside the
// shell so navigation stays available. Fernly look: f-card surfaces,
// pulse skeletons, accent pill buttons.

import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/formatters";

export type PageSkeletonVariant = "dashboard" | "list" | "grid" | "detail";

function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("f-card p-5", className)}>{children}</div>;
}

/** Route-level skeleton: page header + a body shaped like the page. */
export function PageSkeleton({ variant = "list" }: { variant?: PageSkeletonVariant }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Caricamento…</span>
      <header className="space-y-3">
        <Skeleton variant="text" className="h-8 w-56" />
        <Skeleton variant="line" className="w-80 max-w-full" />
      </header>

      {variant === "dashboard" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i}>
                <Skeleton variant="line" width={96} className="mb-4" />
                <Skeleton variant="text" className="mb-3 h-10 w-28" />
                <Skeleton variant="line" width={120} />
              </SkeletonCard>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SkeletonCard className="h-72 lg:col-span-2">
              <Skeleton variant="line" width={140} />
              <Skeleton variant="block" className="mt-6 h-48 w-full" />
            </SkeletonCard>
            <SkeletonCard className="h-72">
              <Skeleton variant="line" width={120} />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="text" className="w-full" />
                ))}
              </div>
            </SkeletonCard>
          </div>
        </>
      )}

      {variant === "list" && (
        <SkeletonCard className="space-y-1 p-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl px-3 py-3">
              <Skeleton variant="circle" width={36} height={36} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-1/3" />
                <Skeleton variant="line" className="w-1/2" />
              </div>
              <Skeleton variant="block" width={72} height={22} />
            </div>
          ))}
        </SkeletonCard>
      )}

      {variant === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i}>
              <Skeleton variant="block" className="mb-4 h-28 w-full" />
              <Skeleton variant="text" className="mb-2 w-2/3" />
              <Skeleton variant="line" className="w-1/2" />
            </SkeletonCard>
          ))}
        </div>
      )}

      {variant === "detail" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonCard className="space-y-4 lg:col-span-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton variant="text" className="w-1/2" />
                <Skeleton variant="text" className="w-20" />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard className="space-y-3">
            <Skeleton variant="line" width={120} />
            <Skeleton variant="block" className="h-24 w-full" />
            <Skeleton variant="block" className="h-10 w-full" />
          </SkeletonCard>
        </div>
      )}
    </div>
  );
}

/** Body of an `error.tsx` boundary (the boundary file itself is a client component). */
export function RouteErrorView({
  reset,
  homeHref,
  homeLabel = "Torna alla dashboard",
  digest,
}: {
  reset: () => void;
  homeHref: string;
  homeLabel?: string;
  digest?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div role="alert" className="f-card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--f-danger,#DC2626)_12%,transparent)] text-[var(--f-danger,#DC2626)]">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-[var(--f-ink)]">Qualcosa è andato storto</h1>
        <p className="mt-2 text-sm text-[var(--f-muted)]">
          Non siamo riusciti a caricare questa pagina. Riprova: se il problema
          continua, torna indietro e riprova più tardi.
        </p>
        {digest && (
          <p className="mt-2 font-mono text-[11px] text-[var(--f-faint,var(--f-muted))]">Codice: {digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="f-btn f-btn-primary">
            Riprova
          </button>
          <Link href={homeHref} className="f-btn f-btn-outline">
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Body of a `not-found.tsx`. */
export function RouteNotFoundView({ homeHref, homeLabel = "Torna alla dashboard" }: { homeHref: string; homeLabel?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="f-card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--acc-50)] text-[var(--acc-700)]">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-[var(--f-ink)]">Pagina non trovata</h1>
        <p className="mt-2 text-sm text-[var(--f-muted)]">
          La pagina che cerchi non esiste, è stata spostata o non hai i
          permessi per vederla.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href={homeHref} className="f-btn f-btn-primary">
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
