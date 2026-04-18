import { Skeleton } from "@/components/ui/skeleton";

export default function MessaggiLoading() {
  return (
    <div className="flex h-[calc(100vh-var(--chrome-top,64px))] divide-x divide-[color:var(--color-border-subtle)]">
      <div className="w-80 shrink-0 overflow-hidden">
        <div className="p-4 border-b border-[color:var(--color-border-subtle)]">
          <Skeleton variant="line" className="w-full h-9" />
        </div>
        <div className="divide-y divide-[color:var(--color-border-subtle)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton variant="text" className="w-1/2" />
              <Skeleton variant="line" className="w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-3">
        <Skeleton variant="line" className="w-1/3 h-6 mb-6" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="line" className={i % 2 === 0 ? "w-2/3" : "w-1/2 ml-auto"} />
        ))}
      </div>
    </div>
  );
}
