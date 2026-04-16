import { Skeleton } from "@/components/ui/skeleton";

export default function CercaLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-56 h-8 mb-3" />
        <Skeleton variant="line" className="w-96" />
      </header>
      <div className="mb-6">
        <Skeleton variant="block" className="w-full h-11" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <div className="flex items-start gap-3 mb-3">
              <Skeleton variant="block" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-3/4" />
                <Skeleton variant="line" className="w-1/2" />
              </div>
            </div>
            <Skeleton variant="line" className="w-full mb-2" />
            <Skeleton variant="line" className="w-2/3 mb-4" />
            <div className="flex justify-between items-center">
              <Skeleton variant="text" width={64} />
              <Skeleton variant="block" width={88} height={32} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
