"use client";

type GrainProps = {
  opacity?: number;
  blendMode?: "multiply" | "overlay" | "soft-light" | "normal";
  zIndex?: number;
};

export function Grain({
  opacity = 0.05,
  blendMode = "multiply",
  zIndex = 1,
}: GrainProps) {
  return (
    <div
      aria-hidden
      // Desktop-only. A fixed, full-viewport layer with mix-blend-mode forces
      // the compositor to re-blend the whole screen on every scroll frame —
      // cheap on desktop GPUs, a major scroll-jank / INP cost on mobile. Hidden
      // below lg; the texture is a subtle finish nobody misses on a phone.
      className="pointer-events-none fixed inset-0 hidden lg:block"
      style={{
        zIndex,
        opacity,
        mixBlendMode: blendMode,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "240px 240px",
      }}
    />
  );
}
