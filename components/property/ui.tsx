// Server-safe brand atoms. Letters are always real text in the house's own
// display face (never generated lettering); marks are hand-built SVG (lib/mark.ts).
//   Mark      — 64×64 badge.
//   Wordmark  — Mark + name. Garden: condensed caps signage. Napsugár: postcard script.
//   Stamp     — Napsugár's postage stamp (perforated edge), the postcard signature.

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

/** tone="band": on the footer band (band-2), whose foreground differs from the page fg. */
export function Wordmark({ site, size = 38, tone = "page" }: { site: Site; size?: number; tone?: "page" | "band" }) {
  const fg = tone === "band" ? "text-band-2-fg" : "text-fg"
  const sub = tone === "band" ? "text-band-2-fg/80" : "text-fg/80"
  const b = BRANDS[site]
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark site={site} size={size} />
      <span className="flex flex-col leading-none">
        <span className={`${site === 'velence' ? 'font-display text-[1.6rem] font-extrabold uppercase tracking-[0.04em]' : 'font-display text-[1.5rem]'} ${fg}`}>
          {b.name}
        </span>
        <span className={`mt-1 whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.2em] ${sub}`}>Vendégház · Velence</span>
      </span>
    </span>
  )
}

/** Postage stamp with a perforated edge (scalloped mask), holding the sun mark. */
export function Stamp({ className = '', caption = 'Velence · 2481' }: { className?: string; caption?: string }) {
  const c = BRANDS.napsugar.colors
  const holes = Array.from({ length: 9 }, (_, i) => 6 + i * 12)
  const side = Array.from({ length: 11 }, (_, i) => 6 + i * 11.6)
  return (
    <span className={`relative inline-block select-none ${className}`} style={{ width: 108, height: 128 }} aria-hidden="true">
      <svg viewBox="0 0 108 128" width="108" height="128" className="absolute inset-0 drop-shadow-[0_8px_14px_rgb(28_41_48/0.25)]">
        <defs>
          <mask id="perf">
            <rect width="108" height="128" fill="white" />
            {holes.map((x) => <circle key={`t${x}`} cx={x} cy="0" r="3.4" fill="black" />)}
            {holes.map((x) => <circle key={`b${x}`} cx={x} cy="128" r="3.4" fill="black" />)}
            {side.map((y) => <circle key={`l${y}`} cx="0" cy={y} r="3.4" fill="black" />)}
            {side.map((y) => <circle key={`r${y}`} cx="108" cy={y} r="3.4" fill="black" />)}
          </mask>
        </defs>
        <rect width="108" height="128" fill={c.cream} mask="url(#perf)" />
        <rect x="9" y="9" width="90" height="110" fill={c.accent} />
      </svg>
      <span className="absolute inset-x-0 top-[18px] flex justify-center"><Mark site="napsugar" size={58} /></span>
      <span className="absolute inset-x-0 bottom-[34px] text-center font-display text-[1.1rem] leading-none text-[#1C2930]">Napsugár</span>
      <span className="absolute inset-x-0 bottom-[17px] text-center text-[0.56rem] font-bold uppercase tracking-[0.14em] text-[#1C2930]">{caption}</span>
    </span>
  )
}
