'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav'

// The one menu of the site, desktop included: a button top-right opens a
// panel (full screen on phones, a right-hand sheet from 768 px). Focus moves
// into the panel, Escape / backdrop / any link closes it, focus returns to the button.

export function SiteMenu({ items, footer, label = 'Menü' }: { items: NavItem[]; footer: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const path = usePathname().replace(/^\/(velence|napsugar)(?=\/|$)/, '') || '/'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a, button')
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center gap-3 rounded-full border border-current/25 bg-surface/90 px-4 text-sm font-semibold text-fg backdrop-blur hover:border-current/60"
      >
        <span>{label}</span>
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M0 1h18M0 6h18M0 11h12" stroke="currentColor" strokeWidth="1.8" /></svg>
      </button>

      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        hidden={!open}
        className="fixed inset-0 z-50"
      >
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} className="absolute inset-0 hidden cursor-default bg-fg/40 md:block" />
        <div ref={panel} className="menu-sheet absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto bg-surface text-fg md:max-w-[440px] md:border-l md:border-rule">
          <div className="flex items-center justify-end px-4 py-4 md:px-8">
            <button type="button" onClick={() => { close(); btn.current?.focus() }} className="inline-flex min-h-12 items-center gap-3 rounded-full border border-rule px-4 text-sm font-semibold">
              Bezárás
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
          </div>
          <nav aria-label="Fő navigáció" className="px-4 md:px-8">
            <ul className="divide-y divide-rule border-y border-rule">
              {items.map((it) => {
                const current = !it.external && path === it.href
                const cls = 'flex min-h-14 items-center justify-between gap-4 py-3 font-display text-[1.7rem] leading-tight hover:text-pop'
                return (
                  <li key={it.href}>
                    {it.external ? (
                      <a href={it.href} className={cls} onClick={close}>
                        {it.label} <span aria-hidden="true" className="text-lg text-soft">↗</span>
                      </a>
                    ) : (
                      <Link href={it.href} className={cls} aria-current={current ? 'page' : undefined} onClick={close}>
                        {it.label}
                        {current && <span className="text-xs font-sans font-semibold uppercase tracking-[0.16em] text-pop">itt vagy</span>}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="mt-auto px-4 pb-8 pt-10 md:px-8">{footer}</div>
        </div>
      </div>
    </>
  )
}
