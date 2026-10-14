// Server-safe brand atoms, hand-built SVG (no AI-generated lettering — the
// letters are always real text in Fraunces, which carries ő/ű).
//   Mark       — 64×64 badge. Garden: leaf over lake ripples. Napsugár: rising sun over ripples.
//   Wordmark   — Mark + name set in Fraunces.
//   Seal       — the signature stamp: Garden wax seal / Napsugár sun seal.
//   RippleDivider — the shared water-line device.

import type { Site } from '@/lib/site-map'
import { BRANDS } from '@/lib/brand'
import { markShapes, reactAttrs } from '@/lib/mark'

export function Mark({ site, size = 40, className = '' }: { site: Site; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      {markShapes(site).map((sh, i) => {
        const Tag = sh.tag
        return <Tag key={i} {...reactAttrs(sh.attrs)} />
      })}
    </svg>
  )
}

export function Wordmark({ site, tone = 'dark', size = 36 }: { site: Site; tone?: 'dark' | 'light'; size?: number }) {
  const b = BRANDS[site]
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark site={site} size={size} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[1.35rem] ${tone === 'light' ? 'text-cream' : 'text-deep'}`}>{b.name}</span>
        <span className={`mt-1 whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.2em] ${tone === 'light' ? 'text-cream/80' : 'text-muted'}`}>
          Vendégház · Velence
        </span>
      </span>
    </span>
  )
}

export function Seal({ site, className = '' }: { site: Site; className?: string }) {
  const b = BRANDS[site]
  if (site === 'velence') {
    return (
      <span
        className={`inline-flex flex-col items-center justify-center rounded-full text-center text-cream select-none ${className}`}
        style={{
          width: 104, height: 104, transform: 'rotate(-8deg)',
          background: `radial-gradient(circle at 35% 30%, #C16A41 0%, ${b.colors.action} 70%, ${b.colors.deep700} 130%)`,
          boxShadow: '0 10px 24px -10px rgb(168 85 47 / 0.6), inset 0 2px 6px rgb(255 255 255 / 0.25)',
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: '0.18em', opacity: 0.9 }}>GARDEN</span>
        <span className="font-display" style={{ fontSize: 17, lineHeight: 1.05, marginTop: 2 }}>egyben<br />bérelhető</span>
      </span>
    )
  }
  // Napsugár: a sun disc with a ring of rays, same stamp principle.
  return (
    <span className={`relative inline-flex select-none items-center justify-center ${className}`} style={{ width: 120, height: 120, transform: 'rotate(6deg)' }}>
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" className="absolute inset-0">
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2
          const f = (n: number) => Math.round(n * 100) / 100
          return <line key={i} x1={f(60 + 49 * Math.cos(a))} y1={f(60 + 49 * Math.sin(a))} x2={f(60 + 58 * Math.cos(a))} y2={f(60 + 58 * Math.sin(a))} stroke={b.colors.accent} strokeWidth="3" strokeLinecap="round" />
        })}
      </svg>
      <span
        className="relative inline-flex flex-col items-center justify-center rounded-full text-center"
        style={{
          width: 92, height: 92, color: b.colors.deep700,
          background: `radial-gradient(circle at 38% 32%, #F6C27A 0%, ${b.colors.accent} 62%, #C96F22 120%)`,
          boxShadow: '0 10px 24px -10px rgb(201 111 34 / 0.65), inset 0 2px 6px rgb(255 255 255 / 0.35)',
        }}
      >
        <span style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700 }}>NAPSUGÁR</span>
        <span className="font-display" style={{ fontSize: 15.5, lineHeight: 1.05, marginTop: 2 }}>egyben<br />bérelhető</span>
      </span>
    </span>
  )
}

export function RippleDivider({ className = '', tone = 'deep' }: { className?: string; tone?: 'deep' | 'accent' | 'reed' }) {
  const stroke = tone === 'accent' ? 'var(--color-accent)' : tone === 'reed' ? 'var(--color-reed)' : 'var(--color-deep)'
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 40" preserveAspectRatio="none" className={`block h-6 w-full opacity-70 ${className}`}>
      <path d="M0 20 Q 75 4 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M0 28 Q 75 14 150 28 T 300 28 T 450 28 T 600 28 T 750 28 T 900 28 T 1050 28 T 1200 28" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
