import { cn } from "@/lib/utils/formatters";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-sage-muted/40",
        className
      )}
      aria-hidden="true"
    />
  );
}

function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-white rounded-2xl p-6 shadow-card", className)}>
      <Skeleton className="h-4 w-3/4 mb-4" />
      <Skeleton className="h-3 w-1/2 mb-2" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="p-4 bg-gray-50">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-t border-sage-muted/30">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable };
