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

// Gate for the GSAP/SplitText reveal animations. Returns true only on
// pointer-fine, motion-allowed devices (i.e. desktop). On touch devices
// (phones/tablets, `pointer: coarse`) and when the user prefers reduced
// motion we skip the animations entirely AND never dynamic-import the GSAP
// chunk — that keeps the marketing bundle off the mobile main thread, which
// is where the heavy parse/execute cost (and thus TBT) was coming from.
// Mirrors the existing coarse-pointer gating in LenisProvider and useMagnetic.
export function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}
