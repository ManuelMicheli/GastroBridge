import { Skeleton } from "@/components/ui/skeleton";

export default function CataloghiLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-44 h-8 mb-3" />
        <Skeleton variant="line" className="w-72" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <Skeleton variant="text" className="w-2/3 mb-3" />
            <Skeleton variant="line" className="w-full mb-2" />
            <Skeleton variant="line" className="w-3/4 mb-4" />
            <div className="flex justify-between">
              <Skeleton variant="line" width={64} />
              <Skeleton variant="line" width={48} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
