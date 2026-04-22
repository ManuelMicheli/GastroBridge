export const MOTION = {
  easeOutExpo: "expo.out",
  easeEditorial: "power3.out",
  easeDramatic: "power4.out",
  duration: {
    revealShort: 0.6,
    revealBase: 0.8,
    revealLong: 0.9,
    counter: 1.6,
  },
  stagger: {
    word: 0.06,
    line: 0.12,
    block: 0.08,
  },
  scrollTrigger: {
    defaultStart: "top 75%",
    onceTrue: true,
  },
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
