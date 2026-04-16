import { Skeleton } from "@/components/ui/skeleton";

export default function ImpostazioniLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-44 h-8 mb-3" />
        <Skeleton variant="line" className="w-96" />
      </header>
      <Skeleton variant="text" className="w-24 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <div className="flex items-center gap-4">
              <Skeleton variant="block" width={44} height={44} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-2/3" />
                <Skeleton variant="line" className="w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
