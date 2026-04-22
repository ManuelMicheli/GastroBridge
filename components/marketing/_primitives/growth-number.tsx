"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { cn } from "@/lib/utils/formatters";
import { prefersReducedMotion } from "@/lib/marketing-motion";

type Props = {
  value: number | null;
  display?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  placeholder?: string;
  formatter?: (v: number) => string;
};

export function GrowthNumber({
  value,
  display,
  suffix,
  duration = 1.6,
  className,
  placeholder = "[TBD]",
  formatter,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value == null) {
      el.textContent = display ?? placeholder;
      return;
    }

    if (prefersReducedMotion()) {
      el.textContent = `${formatter ? formatter(value) : value}${suffix ?? ""}`;
      return;
    }

    const obj = { v: 0 };
    el.textContent = `0${suffix ?? ""}`;
    const trigger = gsap.to(obj, {
      v: value,
      duration,
      ease: "expo.out",
      onUpdate: () => {
        const rounded = Math.round(obj.v);
        el.textContent = `${formatter ? formatter(rounded) : rounded}${suffix ?? ""}`;
      },
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        once: true,
      },
    });

    return () => {
      trigger.scrollTrigger?.kill();
      trigger.kill();
    };
  }, [value, display, suffix, duration, placeholder, formatter]);

  return <span ref={ref} className={cn("tabular-nums", className)} />;
}
