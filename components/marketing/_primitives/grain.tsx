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
      className="pointer-events-none fixed inset-0"
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
