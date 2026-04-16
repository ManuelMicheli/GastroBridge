export function EmptyProductsIllustration({ className }: { className?: string }) {
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
      <path
        d="M70 60 L100 44 L130 60 L130 110 L100 126 L70 110 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M70 60 L100 76 L130 60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <line x1="100" y1="76" x2="100" y2="126" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="148" cy="44" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
