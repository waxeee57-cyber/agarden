'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { BRANDS, telHref } from '@/lib/brand'
import { DEFAULT_SITE, type Site } from '@/lib/sites'
import { Wordmark } from '@/components/property/ui'

// Root 404 (paths outside a house subtree). A client component on purpose:
// this boundary is part of every page's server tree, and a headers()-based
// version made every house page dynamic. The house is read from the hostname.
export default function NotFound() {
  const site = useSyncExternalStore<Site>(
    () => () => {},
    () => (/napsugar/i.test(window.location.hostname) ? 'napsugar' : DEFAULT_SITE),
    () => DEFAULT_SITE
  )
  const b = BRANDS[site]
  return (
    <div data-skin={site} className="skin-root flex flex-col">
      <title>Az oldal nem található</title>
      <meta name="robots" content="noindex, follow" />
      <header className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8">
        <Link href="/" className="inline-block rounded-full"><Wordmark site={site} /></Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-20 md:px-8">
        <p className="kicker">404</p>
        <h1 className="mt-3 text-5xl md:text-7xl">Ilyen oldal nincs.</h1>
        <p className="mt-5 max-w-[46ch] text-lg text-fg/85">Lehet, hogy elírás történt, vagy a link elavult. A ház minden fontos információja a menüből elérhető.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-act">Vissza a kezdőlapra</Link>
          <Link href="/foglalas" className="btn btn-line">Foglalás</Link>
          <a href={telHref(b.phone)} className="btn btn-line">{b.phone}</a>
        </div>
      </main>
    </div>
  )
}
