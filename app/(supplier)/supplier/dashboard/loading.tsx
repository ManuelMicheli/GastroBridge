import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierDashboardLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-56 h-8 mb-3" />
        <Skeleton variant="line" className="w-80" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
          >
            <Skeleton variant="line" className="w-1/2 mb-3" />
            <Skeleton variant="text" className="w-2/3 h-7 mb-2" />
            <Skeleton variant="line" className="w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-[color:var(--color-border-subtle)]">
          <Skeleton variant="text" className="w-1/4 mb-4" />
          <Skeleton variant="line" className="w-full h-64" />
        </div>
        <div className="bg-white rounded-xl p-6 border border-[color:var(--color-border-subtle)] space-y-3">
          <Skeleton variant="text" className="w-1/3 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="line" className="w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
