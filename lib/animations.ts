"use client";

import { gsap, ScrollTrigger } from "@/lib/gsap-config";

/** Fade-in + slide-up triggered on scroll */
export function fadeInUp(
  element: gsap.TweenTarget,
  options?: { delay?: number; duration?: number; y?: number; trigger?: string | Element }
) {
  return gsap.fromTo(
    element,
    { opacity: 0, y: options?.y ?? 30 },
    {
      opacity: 1,
      y: 0,
      duration: options?.duration ?? 0.8,
      delay: options?.delay ?? 0,
      ease: "power3.out",
      scrollTrigger: {
        trigger: (options?.trigger ?? element) as gsap.DOMTarget,
        start: "top 80%",
        once: true,
      },
    }
  );
}

/** Animate a number from 0 to target on scroll */
export function counterAnimation(
  element: HTMLElement,
  target: number,
  options?: { duration?: number; suffix?: string; separator?: string }
) {
  const obj = { val: 0 };
  const suffix = options?.suffix ?? "";
  const sep = options?.separator ?? ".";

  return gsap.to(obj, {
    val: target,
    duration: options?.duration ?? 2.5,
    ease: "power2.out",
    scrollTrigger: {
      trigger: element,
      start: "top 80%",
      once: true,
    },
    onUpdate() {
      const formatted = Math.round(obj.val).toLocaleString("it-IT");
      element.textContent = formatted + suffix;
    },
  });
}
