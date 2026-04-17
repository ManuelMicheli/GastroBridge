import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/formatters";

type CardPadding = "compact" | "default" | "hero" | "none";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  clickable?: boolean;
  glow?: boolean;
}

const paddingMap: Record<CardPadding, string> = {
  none: "p-0",
  compact: "p-4",
  default: "p-5",
  hero: "p-7",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      style,
      padding = "default",
      clickable = false,
      glow = false,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-xl border border-[color:var(--color-border-subtle)]",
        paddingMap[padding],
        clickable &&
          "cursor-pointer hover:-translate-y-[1px] transition-[transform,box-shadow] duration-[var(--duration-fast,150ms)]",
        glow && "dark:hover:[box-shadow:var(--glow-brand)]",
        className
      )}
      style={{ boxShadow: "var(--elevation-card-active)", ...style }}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 pb-4", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-bold text-charcoal font-body", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-sage", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

const CardEyebrow = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em] text-brand-depth",
        className
      )}
      {...props}
    />
  )
);
CardEyebrow.displayName = "CardEyebrow";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardEyebrow,
  type CardProps,
  type CardPadding,
};
