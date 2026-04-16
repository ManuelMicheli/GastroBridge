export function EmptyCartIllustration({ className }: { className?: string }) {
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
        d="M40 50 L60 50 L74 110 L150 110"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M65 70 L156 70 L148 102 L72 102 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <circle cx="86" cy="128" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="138" cy="128" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="160" cy="46" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
