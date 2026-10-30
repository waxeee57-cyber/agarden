'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BRANDS, telHref } from '@/lib/brand'
import { isSite } from '@/lib/sites'
import { Wordmark } from '@/components/property/ui'

// 404 inside a house subtree. Client component on purpose: the house comes
// from the route params, so the pages around it stay static (ISR) — a
// headers()-based boundary here made every house page dynamic.
export default function SiteNotFound() {
  const params = useParams<{ site: string }>()
  const site = isSite(params.site) ? params.site : 'velence'
  const b = BRANDS[site]
  return (
    <div data-skin={site} className="skin-root flex flex-col">
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
