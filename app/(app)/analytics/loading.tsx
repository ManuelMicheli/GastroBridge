import { Skeleton } from "@/components/ui/skeleton";

function FrameSkeleton({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border border-border-subtle bg-surface-card ${className}`}
    >
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          {label}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </header>
      <div className="px-4 pb-4 pt-2">{children}</div>
    </section>
  );
}

export default function AnalyticsLoading() {
  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="line" width={96} />
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <Skeleton variant="line" width={96} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton variant="text" className="h-8 w-52" />
            <Skeleton variant="line" className="w-96" />
          </div>
          <Skeleton variant="block" width={240} height={32} />
        </div>
      </header>

      {/* KPI strip */}
      <section>
        <div className="flex items-center gap-3">
          <Skeleton variant="line" width={96} />
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <Skeleton variant="line" width={64} />
        </div>
        <div
          className="mt-3 grid gap-3"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border-subtle bg-surface-card p-5"
            >
              <Skeleton variant="line" width={72} className="mb-3" />
              <Skeleton variant="text" className="mb-2 h-7 w-28" />
              <Skeleton variant="line" width={56} />
            </div>
          ))}
        </div>
      </section>

      {/* Budget + Variance */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <FrameSkeleton label="Budget · Mese">
          <div className="space-y-4">
            <Skeleton variant="text" className="h-8 w-40" />
            <Skeleton variant="block" className="h-1.5 w-full" />
            <div className="grid grid-cols-2 gap-6 pt-3">
              <Skeleton variant="line" width={96} />
              <Skeleton variant="line" width={96} />
            </div>
          </div>
        </FrameSkeleton>
        <FrameSkeleton label="Varianza · vs Precedente">
          <div className="space-y-3">
            <Skeleton variant="text" className="h-8 w-40" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="line" className="h-3 w-full" />
              ))}
            </div>
          </div>
        </FrameSkeleton>
      </div>

      {/* Categorie + YoY */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <FrameSkeleton label="Breakdown · Categorie">
          <Skeleton variant="block" className="h-52 w-full" />
        </FrameSkeleton>
        <FrameSkeleton label="Trend · 12 mesi YoY">
          <Skeleton variant="block" className="h-52 w-full" />
        </FrameSkeleton>
      </div>

      {/* Ordini log */}
      <FrameSkeleton label="Ordini · Recenti">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="line" className="h-5 w-full" />
          ))}
        </div>
      </FrameSkeleton>
    </div>
  );
}
