export function EmptySearchIllustration({ className }: { className?: string }) {
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
      <circle
        cx="90"
        cy="70"
        r="36"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="116"
        y1="96"
        x2="140"
        y2="120"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <line x1="78" y1="60" x2="102" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="78" y1="76" x2="92" y2="76" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="146" cy="34" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
