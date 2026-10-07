import { Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";

/** Settings section the current team role cannot manage. */
export function RestrictedSettings({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader title={title} />
      <FCard index={0}>
        <div className="flex flex-col items-center py-10 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--f-fill)]">
            <Lock className="h-5 w-5 text-[var(--f-muted)]" aria-hidden />
          </span>
          <p className="f-card-title">Accesso limitato</p>
          <p className="mt-1.5 max-w-sm text-[13.5px] text-[var(--f-muted)]">{body}</p>
        </div>
      </FCard>
    </div>
  );
}
