export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gr-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#13213b" />
          <stop offset="1" stopColor="#0b1220" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="10" fill="url(#gr-logo-bg)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="2.5 2.5" />
      <circle cx="20" cy="20" r="8" fill="none" stroke="#f97316" strokeWidth="1.6" strokeOpacity="0.75" />
      <path d="M8 20h5l2.2-5 3.4 10 2.6-7 1.6 2H32" fill="none" stroke="#f8fafc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2.2" fill="#e11d48" />
    </svg>
  );
}
