import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierOrdiniLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-44 h-8 mb-3" />
        <Skeleton variant="line" className="w-72" />
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-4 border border-[color:var(--color-border-subtle)]"
          >
            <Skeleton variant="line" className="w-1/2 mb-3" />
            <Skeleton variant="text" className="w-2/3 h-7" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-[color:var(--color-border-subtle)] divide-y divide-[color:var(--color-border-subtle)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton variant="line" width={48} height={48} className="rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-1/3" />
              <Skeleton variant="line" className="w-1/2" />
            </div>
            <Skeleton variant="line" width={80} />
          </div>
        ))}
      </div>
    </div>
  );
}
