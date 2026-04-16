import { Skeleton } from "@/components/ui/skeleton";

export default function FornitoriLoading() {
  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton variant="text" className="w-48 h-8" />
          <Skeleton variant="line" className="w-96" />
        </div>
        <Skeleton variant="block" width={160} height={32} />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <div className="flex items-start gap-4">
              <Skeleton variant="block" width={56} height={56} />
              <div className="flex-1 space-y-3">
                <Skeleton variant="text" className="w-3/4" />
                <Skeleton variant="line" className="w-1/2" />
                <Skeleton variant="line" className="w-full" />
                <div className="flex gap-2 pt-1">
                  <Skeleton variant="line" width={56} />
                  <Skeleton variant="line" width={48} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
