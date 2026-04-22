import { cn } from "@/lib/utils/formatters";

type Props = {
  className?: string;
  inset?: boolean;
  strong?: boolean;
};

export function SectionRule({ className, inset = true, strong = false }: Props) {
  return (
    <hr
      className={cn(
        "rule",
        inset && "mx-[var(--gutter-marketing)]",
        className
      )}
      style={strong ? { borderTop: "1px solid var(--color-marketing-rule-strong)" } : undefined}
    />
  );
}
