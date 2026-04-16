export function EmptySuppliersIllustration({ className }: { className?: string }) {
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
      <rect x="50" y="60" width="46" height="80" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="104" y="40" width="46" height="100" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="60" y1="78" x2="86" y2="78" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="60" y1="92" x2="78" y2="92" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="114" y1="58" x2="140" y2="58" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="114" y1="72" x2="132" y2="72" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="40" y1="140" x2="160" y2="140" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="158" cy="38" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
