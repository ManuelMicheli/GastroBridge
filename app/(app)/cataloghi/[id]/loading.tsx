import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogDetailLoading() {
  return (
    <div>
      <header className="mb-6">
        <Skeleton variant="text" className="w-64 h-8 mb-3" />
        <Skeleton variant="line" className="w-96 mb-2" />
        <div className="flex gap-2 mt-3">
          <Skeleton variant="line" width={96} />
          <Skeleton variant="line" width={120} />
        </div>
      </header>

      <div className="bg-white rounded-xl border border-[color:var(--color-border-subtle)] overflow-hidden">
        <div className="p-4 border-b border-[color:var(--color-border-subtle)] flex justify-between">
          <Skeleton variant="line" width={160} />
          <Skeleton variant="line" width={120} />
        </div>
        <div className="divide-y divide-[color:var(--color-border-subtle)]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Skeleton variant="text" className="w-1/2 mb-2" />
                <Skeleton variant="line" className="w-1/3" />
              </div>
              <Skeleton variant="line" width={80} />
              <Skeleton variant="line" width={64} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
