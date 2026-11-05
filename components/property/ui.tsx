// Server-safe brand atoms. Letters are always real text in the display face
// (never generated lettering); marks are hand-built SVG (lib/mark.ts).
//   Mark      64×64 badge, the only per-house graphic besides the accent.
//   Wordmark  Mark + house name (Prata HU) + "Vendégház · Velence".
//   Icon      the few line icons the pages need (stroke = currentColor).

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

/** tone="band": on the dark footer/contact band. */
export function Wordmark({ site, size = 40, tone = 'page' }: { site: Site; size?: number; tone?: 'page' | 'band' }) {
  const b = BRANDS[site]
  return (
    <span className="inline-flex items-center gap-3">
      <Mark site={site} size={size} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[1.55rem] tracking-[-0.01em] ${tone === 'band' ? 'text-band-fg' : 'text-fg'}`}>{b.name}</span>
        <span className={`font-ui mt-1 whitespace-nowrap text-[0.62rem] font-bold uppercase tracking-[0.24em] ${tone === 'band' ? 'text-band-fg/75' : 'text-soft'}`}>Vendégház · Velence</span>
      </span>
    </span>
  )
}

const PATHS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-.5 1.5L12 13l8.5-6.5',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  out: 'M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M4 12.5 9.5 18 20 6',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  tub: 'M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2zM6 12V6a2 2 0 0 1 4 0M9 3.5c-.8 1 .8 1.8 0 2.8M13 3.5c-.8 1 .8 1.8 0 2.8M17 3.5c-.8 1 .8 1.8 0 2.8',
  heat: 'M4 20h16M6 20V9l6-5 6 5v11M9 17c0-1.5 1.5-2 1.5-3.5M12.5 17c0-1.5 1.5-2 1.5-3.5',
  fire: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1.5 1 2.5 2 2.5 0-2-1-4 0-7zM5 21h14',
  car: 'M4 16v-4l2-5h12l2 5v4M4 16h16v2H4zM7 16v2m10-2v2M4 12h16M7.5 13.5h.01M16.5 13.5h.01',
  bed: 'M3 18V7m0 6h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 11.5a1.5 1.5 0 1 0 0-.01',
  paw: 'M12 20c-3 0-5-1.5-5-3.5S9.5 12 12 12s5 2.5 5 4.5S15 20 12 20zM6 10a1.6 2 0 1 0 0-.01M10 7a1.6 2 0 1 0 0-.01M14 7a1.6 2 0 1 0 0-.01M18 10a1.6 2 0 1 0 0-.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  snow: 'M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2',
  baby: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 21v-5a5 5 0 0 1 10 0v5M10 7h.01M14 7h.01',
  home: 'M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 13.5a6 6 0 0 1 4 6.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  facebook:'M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM17.3 6.7h.01',
  tiktok: 'M15 3c.4 2.6 2 4.2 4.5 4.5v3.2c-1.7 0-3.2-.5-4.5-1.4v6.2A5.5 5.5 0 1 1 9.5 10v3.3a2.3 2.3 0 1 0 2.3 2.3V3H15z',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className = '', stroke = 1.6 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  )
}
