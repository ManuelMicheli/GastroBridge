import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierClientiLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-44 h-8 mb-3" />
        <Skeleton variant="line" className="w-72" />
      </header>
      <div className="bg-white rounded-xl border border-[color:var(--color-border-subtle)] divide-y divide-[color:var(--color-border-subtle)]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton variant="line" width={40} height={40} className="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-1/3" />
              <Skeleton variant="line" className="w-1/2" />
            </div>
            <Skeleton variant="line" width={64} />
          </div>
        ))}
      </div>
    </div>
  );
}
