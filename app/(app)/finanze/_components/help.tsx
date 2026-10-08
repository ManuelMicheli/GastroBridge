import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

/**
 * Contextual help: a small "Come funziona?" disclosure placed next to the
 * thing it explains (replaces the old standalone Guida page). Native
 * <details>, so it works in server components and without JS.
 */
export function Help({
  title = "Come funziona?",
  children,
  className,
  defaultOpen = false,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className={cn("group rounded-[14px] bg-[var(--f-fill)] px-4 py-3 text-[13px] text-[var(--f-ink-2)]", className)}
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-[var(--f-ink)] [&::-webkit-details-marker]:hidden">
        <CircleHelp className="h-4 w-4 shrink-0 text-[var(--acc-600)]" aria-hidden />
        <span className="min-w-0 flex-1">{title}</span>
        <span aria-hidden className="text-[var(--f-muted)] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-2.5 space-y-2 leading-relaxed">{children}</div>
    </details>
  );
}

/** Numbered steps used inside <Help> and the wizards. */
export function Steps({ items }: { items: Array<{ title: ReactNode; body?: ReactNode }> }) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--acc-50)] text-[12px] font-semibold text-[var(--acc-700)]"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-[var(--f-ink)]">{s.title}</p>
            {s.body ? <div className="mt-0.5 text-[var(--f-muted)]">{s.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
