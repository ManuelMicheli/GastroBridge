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
  default: "p-5 sm:px-[22px]",
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
        "f-card",
        paddingMap[padding],
        clickable &&
          "cursor-pointer hover:-translate-y-[1px] hover:[box-shadow:var(--elevation-card-hover)] transition-[transform,box-shadow] duration-200",
        glow && "dark:hover:[box-shadow:var(--glow-brand)]",
        className
      )}
      style={style}
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
    className={cn("f-card-title", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-[var(--f-muted)]", className)} {...props} />
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
        "f-eyebrow",
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
