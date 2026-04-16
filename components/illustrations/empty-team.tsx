export function EmptyTeamIllustration({ className }: { className?: string }) {
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
      <circle cx="100" cy="68" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path
        d="M64 130 C64 110 80 96 100 96 C120 96 136 110 136 130"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="60" cy="80" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="140" cy="80" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="156" cy="40" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
