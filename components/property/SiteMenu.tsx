'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav'

// Header navigation in the reference's (velenceviolavilla.hu, Divi) pattern:
//  - from 1024 px: text links top-right, the rest under "Továbbiak" (a dropdown)
//  - below: a hamburger top-right opening a white dropdown panel under the
//    header (blue top rule, one item per row, thin separators)
// Escape / outside click / any link closes; focus returns to the toggle.

const PRIMARY = ['/', '/a-haz', '/kepek', '/foglalas', '/kapcsolat']

export function SiteMenu({ items }: { items: NavItem[] }) {
  const path = usePathname().replace(/^\/(velence|napsugar)(?=\/|$)/, '') || '/'
  const all: NavItem[] = [{ href: '/', label: 'Főoldal' }, ...items]
  const primary = PRIMARY.map((h) => all.find((i) => i.href === h)).filter((x): x is NavItem => !!x)
  const more = all.filter((i) => !PRIMARY.includes(i.href))

  return (
    <>
      <nav aria-label="Fő navigáció" className="hidden items-center gap-1 lg:flex">
        {primary.map((it) => <NavLink key={it.href} it={it} current={path === it.href} />)}
        {more.length > 0 && <MoreMenu items={more} path={path} />}
      </nav>
      <MobileMenu items={all} path={path} />
    </>
  )
}

const linkCls = (current: boolean) =>
  `inline-flex min-h-11 items-center px-3 text-[14px] font-semibold transition-colors ${current ? 'text-nav' : 'text-black/60 hover:text-black/90'}`

function NavLink({ it, current, onClick }: { it: NavItem; current: boolean; onClick?: () => void }) {
  return it.external
    ? <a href={it.href} className={linkCls(false)} onClick={onClick}>{it.label}</a>
    : <Link href={it.href} className={linkCls(current)} aria-current={current ? 'page' : undefined} onClick={onClick}>{it.label}</Link>
}

function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>, toggle: React.RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); toggle.current?.focus() } }
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) close() }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open, close, root, toggle])
}

function MoreMenu({ items, path }: { items: NavItem[]; path: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useDismiss(open, () => setOpen(false), root, btn)
  const active = items.some((i) => i.href === path)
  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className={`${linkCls(active)} gap-1.5`}>
        Továbbiak
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && (
        <ul className="nav-drop absolute right-0 top-full z-50 mt-3 w-60 border-t-[3px] border-nav bg-white py-3 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          {items.map((it) => (
            <li key={it.href}>
              {it.external
                ? <a href={it.href} className="block px-5 py-2 text-[14px] font-semibold text-black/60 hover:bg-black/[0.03] hover:text-black/90" onClick={() => setOpen(false)}>{it.label} <span aria-hidden="true">↗</span></a>
                : <Link href={it.href} aria-current={path === it.href ? 'page' : undefined} className={`block px-5 py-2 text-[14px] font-semibold hover:bg-black/[0.03] ${path === it.href ? 'text-nav' : 'text-black/60 hover:text-black/90'}`} onClick={() => setOpen(false)}>{it.label}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MobileMenu({ items, path }: { items: NavItem[]; path: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useDismiss(open, () => setOpen(false), root, btn)
  return (
    <div ref={root} className="lg:hidden">
      <button ref={btn} type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Menü bezárása' : 'Menü'} onClick={() => setOpen((o) => !o)} className="flex h-12 w-12 items-center justify-center text-nav">
        {open
          ? <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2" /></svg>
          : <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><path d="M1 2h24M1 10h24M1 18h24" stroke="currentColor" strokeWidth="2.4" /></svg>}
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menü" className="nav-drop absolute inset-x-4 top-full z-50 border-t-[3px] border-nav bg-white px-5 py-3 shadow-[0_2px_5px_rgba(0,0,0,0.1)] sm:inset-x-8">
          <ul className="divide-y divide-black/[0.06]">
            {items.map((it) => (
              <li key={it.href}>
                {it.external
                  ? <a href={it.href} className="flex min-h-12 items-center justify-between text-[15px] font-semibold text-black/60" onClick={() => setOpen(false)}>{it.label} <span aria-hidden="true">↗</span></a>
                  : <Link href={it.href} aria-current={path === it.href ? 'page' : undefined} className={`flex min-h-12 items-center text-[15px] font-semibold ${path === it.href ? 'text-nav' : 'text-black/60'}`} onClick={() => setOpen(false)}>{it.label}</Link>}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
