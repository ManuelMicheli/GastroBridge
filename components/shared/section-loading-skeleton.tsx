import { Skeleton } from "@/components/ui/skeleton";

type Variant = "dashboard" | "list" | "form" | "table" | "chart";

type Props = {
  variant?: Variant;
  /** Hide the page header (use when page renders its own header synchronously). */
  noHeader?: boolean;
};

/**
 * Generic section loading skeleton. Used as a Next.js segment-level `loading.tsx`
 * fallback so route transitions feel instant even when the page awaits data.
 *
 * Variants sketch the major page shapes we have across the app:
 *   - dashboard: header + 4 KPI tiles + chart + sidelist
 *   - list:      header + filters + list rows
 *   - form:      header + card with multiple rows
 *   - table:     header + filter bar + wide table
 *   - chart:     header + 2 chart cards + small bottom cards
 */
export function SectionLoadingSkeleton({ variant = "dashboard", noHeader }: Props) {
  return (
    <div className="space-y-6">
      {!noHeader && (
        <header>
          <Skeleton variant="text" className="w-56 h-8 mb-3" />
          <Skeleton variant="line" className="w-96" />
        </header>
      )}

      {variant === "dashboard" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-card rounded-xl p-5 border border-border-subtle"
              >
                <Skeleton variant="line" width={80} className="mb-3" />
                <Skeleton variant="text" className="w-24 h-7 mb-2" />
                <Skeleton variant="line" className="w-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface-card rounded-xl p-6 border border-border-subtle">
              <Skeleton variant="text" className="w-1/4 mb-4" />
              <Skeleton variant="block" className="w-full h-64" />
            </div>
            <div className="bg-surface-card rounded-xl p-6 border border-border-subtle space-y-3">
              <Skeleton variant="text" className="w-1/3 mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="line" className="w-full" />
              ))}
            </div>
          </div>
        </>
      )}

      {variant === "list" && (
        <>
          <div className="flex items-center gap-3">
            <Skeleton variant="block" className="w-full h-10 max-w-md" />
            <Skeleton variant="block" width={120} height={40} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-card rounded-xl p-5 border border-border-subtle"
              >
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton variant="block" width={48} height={48} />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="w-3/4" />
                    <Skeleton variant="line" className="w-1/2" />
                  </div>
                </div>
                <Skeleton variant="line" className="w-full mb-2" />
                <Skeleton variant="line" className="w-2/3" />
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "form" && (
        <div className="bg-surface-card rounded-xl p-6 border border-border-subtle space-y-5 max-w-2xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="line" width={120} />
              <Skeleton variant="block" className="w-full h-10" />
            </div>
          ))}
          <Skeleton variant="block" width={160} height={40} />
        </div>
      )}

      {variant === "table" && (
        <>
          <div className="flex items-center gap-3">
            <Skeleton variant="block" className="w-full h-10 max-w-md" />
            <Skeleton variant="block" width={120} height={40} />
          </div>
          <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <Skeleton variant="line" className="w-1/4" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="px-4 py-3 border-b border-border-subtle last:border-0 flex items-center gap-4"
              >
                <Skeleton variant="circle" width={36} height={36} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-1/3" />
                  <Skeleton variant="line" className="w-1/4" />
                </div>
                <Skeleton variant="block" width={80} height={24} />
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "chart" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-card rounded-xl p-6 border border-border-subtle">
              <Skeleton variant="text" className="w-1/3 mb-4" />
              <Skeleton variant="block" className="w-full h-64" />
            </div>
            <div className="bg-surface-card rounded-xl p-6 border border-border-subtle">
              <Skeleton variant="text" className="w-1/3 mb-4" />
              <Skeleton variant="block" className="w-full h-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-card rounded-xl p-5 border border-border-subtle"
              >
                <Skeleton variant="line" width={80} className="mb-3" />
                <Skeleton variant="text" className="w-20 h-6" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
