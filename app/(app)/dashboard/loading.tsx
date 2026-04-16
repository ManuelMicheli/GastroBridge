import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <header>
        <Skeleton variant="text" className="w-64 h-8 mb-3" />
        <Skeleton variant="line" className="w-96" />
      </header>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <Skeleton variant="line" width={80} className="mb-3" />
            <Skeleton variant="text" className="w-24 h-7 mb-2" />
            <Skeleton variant="line" className="w-full h-8 mt-3" />
          </div>
        ))}
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)] lg:col-span-2 h-72"
          style={{ boxShadow: "var(--elevation-card-active)" }}
        >
          <Skeleton variant="text" className="w-44 mb-4" />
          <Skeleton variant="block" className="w-full h-52" />
        </div>
        <div
          className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
          style={{ boxShadow: "var(--elevation-card-active)" }}
        >
          <Skeleton variant="text" className="w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton variant="line" width={120} />
                <Skeleton variant="line" width={48} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
