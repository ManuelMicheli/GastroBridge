import { cn } from "@/lib/utils/formatters";

type SkeletonVariant = "text" | "line" | "block" | "circle";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  width?: string | number;
  height?: string | number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: "h-4 rounded-md",
  line: "h-3 rounded",
  block: "rounded-lg",
  circle: "rounded-full",
};

function Skeleton({ variant = "text", className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[color:var(--color-surface-hover)]",
        variantStyles[variant],
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]",
        className
      )}
      style={{ boxShadow: "var(--elevation-card-active)" }}
    >
      <Skeleton variant="text" className="w-3/4 mb-4" />
      <Skeleton variant="line" className="w-1/2 mb-2" />
      <Skeleton variant="line" className="w-full mb-2" />
      <Skeleton variant="line" className="w-2/3" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden border border-[color:var(--color-border-subtle)]"
      style={{ boxShadow: "var(--elevation-card-active)" }}
    >
      <div className="p-4 bg-[color:var(--color-surface-hover)]">
        <Skeleton variant="text" className="w-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-4 border-t border-[color:var(--color-border-subtle)]"
        >
          <div className="flex items-center gap-4">
            <Skeleton variant="circle" width={40} height={40} />
            <div className="flex-1">
              <Skeleton variant="text" className="w-1/3 mb-2" />
              <Skeleton variant="line" className="w-1/4" />
            </div>
            <Skeleton variant="block" width={80} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, type SkeletonVariant };
