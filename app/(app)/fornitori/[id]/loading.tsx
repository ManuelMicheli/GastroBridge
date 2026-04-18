import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierDetailLoading() {
  return (
    <div>
      <div className="bg-white rounded-xl p-6 mb-6 border border-[color:var(--color-border-subtle)]">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Skeleton variant="line" width={80} height={80} className="rounded-2xl" />
          <div className="flex-1 space-y-3 w-full">
            <Skeleton variant="text" className="w-1/3 h-7" />
            <Skeleton variant="line" className="w-3/4" />
            <div className="flex flex-wrap gap-4">
              <Skeleton variant="line" width={120} />
              <Skeleton variant="line" width={140} />
              <Skeleton variant="line" width={100} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-4">
        <Skeleton variant="text" width={120} className="h-6" />
        <Skeleton variant="line" width={160} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[color:var(--color-border-subtle)] p-3"
          >
            <Skeleton variant="line" className="aspect-square w-full mb-3" />
            <Skeleton variant="text" className="w-3/4 mb-2" />
            <Skeleton variant="line" className="w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
