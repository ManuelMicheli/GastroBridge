import { SkeletonTable } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-40 bg-sage-muted/40 rounded-xl animate-pulse" />
        <div className="flex gap-3">
          <div className="h-9 w-28 bg-sage-muted/40 rounded-xl animate-pulse" />
          <div className="h-9 w-36 bg-sage-muted/40 rounded-xl animate-pulse" />
        </div>
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
