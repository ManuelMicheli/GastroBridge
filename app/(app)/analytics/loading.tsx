import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton variant="text" className="w-44 h-8" />
          <Skeleton variant="line" className="w-96" />
        </div>
        <Skeleton variant="block" width={200} height={36} />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <Skeleton variant="line" width={96} className="mb-3" />
            <Skeleton variant="text" className="w-32 h-7 mb-2" />
            <Skeleton variant="line" width={64} />
          </div>
        ))}
      </div>

      <div
        className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)] h-80"
        style={{ boxShadow: "var(--elevation-card-active)" }}
      >
        <Skeleton variant="text" className="w-48 mb-4" />
        <Skeleton variant="block" className="w-full h-60" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <Skeleton variant="text" className="w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between items-center">
                  <Skeleton variant="line" width={120} />
                  <Skeleton variant="line" width={56} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
