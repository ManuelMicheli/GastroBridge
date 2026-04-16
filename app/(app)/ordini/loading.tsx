import { Skeleton } from "@/components/ui/skeleton";

export default function OrdiniLoading() {
  return (
    <div>
      <header className="mb-8">
        <Skeleton variant="text" className="w-40 h-8 mb-3" />
        <Skeleton variant="line" className="w-80" />
      </header>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]"
            style={{ boxShadow: "var(--elevation-card-active)" }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton variant="line" width={96} />
                <Skeleton variant="line" width={140} />
              </div>
              <div className="text-right space-y-2">
                <Skeleton variant="text" width={88} />
                <Skeleton variant="block" width={72} height={20} className="ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
