import { Skeleton } from "@/components/ui/skeleton";

export default function CarrelloLoading() {
  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton variant="text" className="w-44 h-8" />
          <Skeleton variant="line" className="w-72" />
        </div>
        <Skeleton variant="block" width={96} height={32} />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
              style={{ boxShadow: "var(--elevation-card-active)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <Skeleton variant="text" className="w-40" />
                <Skeleton variant="text" width={72} />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-4">
                    <Skeleton variant="block" width={48} height={48} />
                    <div className="flex-1 space-y-2">
                      <Skeleton variant="line" className="w-2/3" />
                      <Skeleton variant="line" className="w-1/3" />
                    </div>
                    <Skeleton variant="block" width={96} height={32} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)] h-fit"
          style={{ boxShadow: "var(--elevation-card-active)" }}
        >
          <Skeleton variant="text" className="w-32 mb-4" />
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <Skeleton variant="line" width={96} />
              <Skeleton variant="line" width={64} />
            </div>
            <div className="flex justify-between">
              <Skeleton variant="line" width={96} />
              <Skeleton variant="line" width={64} />
            </div>
          </div>
          <Skeleton variant="block" className="w-full h-11" />
        </div>
      </div>
    </div>
  );
}
