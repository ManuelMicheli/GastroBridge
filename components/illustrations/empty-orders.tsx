export function EmptyOrdersIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="40"
        y="40"
        width="120"
        height="100"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line x1="56" y1="64" x2="144" y2="64" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="96" x2="100" y2="96" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="112" x2="130" y2="112" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="160" cy="40" r="6" fill="var(--color-brand-primary)" />
    </svg>
  );
}
