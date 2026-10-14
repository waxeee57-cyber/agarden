import { BRANDS } from './brand'
import type { Site } from './sites'

// Single source of the hand-built 64×64 house marks. Rendered as React SVG by
// components/property/ui.tsx <Mark/> and serialized to a favicon by
// app/brand/icon. Garden: steam over a tub. Napsugár: rising sun over pool waves.

export type Shape = { tag: 'circle' | 'path' | 'line'; attrs: Record<string, string | number> }

const r2 = (n: number) => Math.round(n * 100) / 100

export function markShapes(site: Site): Shape[] {
  const c = BRANDS[site].colors
  const base: Shape[] = [{ tag: 'circle', attrs: { cx: 32, cy: 32, r: 32, fill: c.deep } }]
  const ripple = (d: string, w: number, op = 1): Shape => ({
    tag: 'path',
    attrs: { d, stroke: c.cream, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', opacity: op },
  })
  if (site === 'velence') {
    // steam rising from a tub: the wellness is the point, not the lake
    const wisp = (x: number): Shape => ({
      tag: 'path',
      attrs: { d: `M${x} 34 c-3.2 -3.6 3.2 -6 0 -9.6 c-3.2 -3.6 3.2 -6 0 -9.4`, stroke: c.cream, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' },
    })
    return [
      ...base,
      wisp(24), wisp(32), wisp(40),
      { tag: 'path', attrs: { d: 'M13 38 H51 V41 A11 11 0 0 1 40 52 H24 A11 11 0 0 1 13 41 Z', fill: c.accent } },
    ]
  }
  const rays: Shape[] = [165, 135, 105, 75, 45, 15].map((deg) => {
    const a = (deg * Math.PI) / 180
    return {
      tag: 'line',
      attrs: {
        x1: r2(32 + 17.5 * Math.cos(a)), y1: r2(40 - 17.5 * Math.sin(a)),
        x2: r2(32 + 23 * Math.cos(a)), y2: r2(40 - 23 * Math.sin(a)),
        stroke: c.accent, 'stroke-width': 2.4, 'stroke-linecap': 'round',
      },
    }
  })
  return [
    ...base,
    { tag: 'path', attrs: { d: 'M19 40 A13 13 0 0 1 45 40 Z', fill: c.accent } },
    ...rays,
    ripple('M12 45 q 5 -3.2 10 0 t 10 0 t 10 0 t 10 0', 2.2),
    ripple('M18 51.5 q 4.7 -3 9.3 0 t 9.3 0 t 9.3 0', 1.8, 0.6),
  ]
}

export function markSvg(site: Site, size = 64): string {
  const body = markShapes(site)
    .map((s) => `<${s.tag} ${Object.entries(s.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${body}</svg>`
}

/** kebab-case SVG attrs -> React camelCase props */
export function reactAttrs(attrs: Shape['attrs']): Record<string, string | number> {
  return Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]))
}
