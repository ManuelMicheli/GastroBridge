import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/formatters";

type SectionAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void }
  | ReactNode;

interface SectionHeaderProps {
  title: string;
  action?: SectionAction;
  className?: string;
}

function isLinkAction(action: SectionAction): action is { label: string; href: string } {
  return (
    typeof action === "object" &&
    action !== null &&
    "href" in (action as object) &&
    "label" in (action as object)
  );
}

function isClickAction(
  action: SectionAction
): action is { label: string; onClick: () => void } {
  return (
    typeof action === "object" &&
    action !== null &&
    "onClick" in (action as object) &&
    "label" in (action as object)
  );
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  const actionLinkStyle = {
    fontSize: "var(--text-caption)",
    letterSpacing: "var(--text-caption--letter-spacing)",
    fontWeight: "var(--text-caption--font-weight)",
  } as const;

  const renderAction = () => {
    if (!action) return null;
    if (isLinkAction(action)) {
      return (
        <Link
          href={action.href}
          className="text-[color:var(--color-text-link)] hover:underline transition-colors uppercase"
          style={actionLinkStyle}
        >
          {action.label} →
        </Link>
      );
    }
    if (isClickAction(action)) {
      return (
        <button
          type="button"
          onClick={action.onClick}
          className="text-[color:var(--color-text-link)] hover:underline transition-colors uppercase"
          style={actionLinkStyle}
        >
          {action.label} →
        </button>
      );
    }
    return action;
  };

  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-4",
        className
      )}
    >
      <h2
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          letterSpacing: "var(--text-title-md--letter-spacing)",
          fontWeight: "var(--text-title-md--font-weight)",
          color: "var(--color-text-primary)",
        }}
      >
        {title}
      </h2>
      {renderAction()}
    </div>
  );
}
