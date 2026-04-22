import { cn } from "@/lib/utils/formatters";

type Props = {
  quote: string;
  author: string;
  role?: string;
  className?: string;
};

export function QuotePull({ quote, author, role, className }: Props) {
  return (
    <figure
      className={cn(
        "relative pl-6 lg:pl-10 max-w-[72ch]",
        className
      )}
      style={{ borderLeft: "1px solid var(--color-marketing-rule-strong)" }}
    >
      <span
        aria-hidden
        className="absolute -top-8 -left-2 font-display leading-none select-none pointer-events-none"
        style={{
          fontSize: "clamp(96px, 14vw, 200px)",
          color: "var(--color-marketing-primary-subtle)",
        }}
      >
        “
      </span>
      <blockquote
        className="font-display italic"
        style={{
          fontSize: "var(--type-marketing-pull)",
          lineHeight: "var(--type-marketing-pull-lh)",
          color: "var(--color-marketing-ink)",
        }}
      >
        {quote}
      </blockquote>
      <figcaption
        className="mt-8 font-mono uppercase"
        style={{
          fontSize: "var(--type-marketing-eyebrow)",
          letterSpacing: "var(--type-marketing-eyebrow-ls)",
          color: "var(--color-marketing-ink-subtle)",
        }}
      >
        <span className="text-[var(--color-marketing-ink)]">— {author}</span>
        {role && (
          <span className="block mt-1.5">{role}</span>
        )}
      </figcaption>
    </figure>
  );
}
