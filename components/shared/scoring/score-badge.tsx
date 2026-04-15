import { clsx } from "clsx";

type Size = "sm" | "md";

function tone(score: number): string {
  if (score >= 70) return "bg-accent-green/15 text-accent-green border-accent-green/30";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-red-100 text-red-700 border-red-300";
}

/**
 * Compact pill badge showing a 0-100 score. Green ≥70, yellow 40-69, red <40.
 */
export function ScoreBadge({
  score,
  size = "md",
  title,
}: {
  score: number;
  size?: Size;
  title?: string;
}) {
  const rounded = Math.round(score);
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center justify-center rounded-full border font-semibold tabular-nums",
        tone(score),
        size === "sm" ? "text-[10px] px-1.5 py-0.5 min-w-[28px]" : "text-xs px-2 py-0.5 min-w-[34px]",
      )}
    >
      {rounded}
    </span>
  );
}
