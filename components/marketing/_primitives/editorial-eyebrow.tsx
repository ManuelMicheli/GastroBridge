import { cn } from "@/lib/utils/formatters";

type Tone = "muted" | "primary" | "subtle";

type Props = {
  children: React.ReactNode;
  tone?: Tone;
  number?: string;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  muted: "text-[var(--color-marketing-ink-muted)]",
  primary: "text-[var(--color-marketing-primary)]",
  subtle: "text-[var(--color-marketing-ink-subtle)]",
};

export function EditorialEyebrow({ children, tone = "subtle", number, className }: Props) {
  return (
    <p
      className={cn(
        "font-mono uppercase leading-none",
        toneClass[tone],
        className
      )}
      style={{
        fontSize: "var(--type-marketing-eyebrow)",
        letterSpacing: "var(--type-marketing-eyebrow-ls)",
      }}
    >
      {number && <span className="mr-3 opacity-70">{number}</span>}
      {children}
    </p>
  );
}
