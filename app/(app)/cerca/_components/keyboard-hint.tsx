// app/(app)/cerca/_components/keyboard-hint.tsx
function cn(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

export function KeyboardHint({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="rounded border border-border-subtle bg-surface-base px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-text-tertiary shadow-[inset_0_-1px_0_0] shadow-border-subtle"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
