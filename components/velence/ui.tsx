// Presentational, server-safe brand atoms: the signature water-ripple divider
// and the "egyben bérelhető" wax-seal stamp.

export function RippleDivider({ className = '', tone = 'pine' }: { className?: string; tone?: 'pine' | 'clay' | 'reed' }) {
  const stroke =
    tone === 'clay' ? 'var(--color-clay)' : tone === 'reed' ? 'var(--color-reed)' : 'var(--color-pine)'
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      className={`block w-full h-6 opacity-70 ${className}`}
    >
      <path
        d="M0 20 Q 75 4 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M0 28 Q 75 14 150 28 T 300 28 T 450 28 T 600 28 T 750 28 T 900 28 T 1050 28 T 1200 28"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

export function WaxSeal({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-full text-cream text-center select-none ${className}`}
      style={{
        width: 104,
        height: 104,
        background: 'radial-gradient(circle at 35% 30%, var(--color-clay) 0%, var(--color-clay-600) 70%, var(--color-pine-700) 130%)',
        boxShadow: '0 10px 24px -10px rgba(168,85,47,0.6), inset 0 2px 6px rgba(255,255,255,0.25)',
        transform: 'rotate(-8deg)',
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: '0.18em', opacity: 0.85 }}>GARDEN</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.05, marginTop: 2 }}>egyben<br />bérelhető</span>
    </span>
  )
}
