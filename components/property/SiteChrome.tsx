import Link from 'next/link'
import type { Site } from '@/lib/site-map'
import { BRANDS, telHref } from '@/lib/brand'
import type { Listing } from '@/lib/listing'
import { Wordmark, RippleDivider } from './ui'

// Header + footer shared by every public page of a house. The sister house is
// only ever an absolute link to ITS domain — never content on this one.

export function SiteHeader({ site, sisterOrigin, overlay = false }: { site: Site; sisterOrigin: string; overlay?: boolean }) {
  const sister = BRANDS[site === 'velence' ? 'napsugar' : 'velence']
  const tone = overlay ? 'light' : 'dark'
  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-30' : 'border-b border-line bg-cream'}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" className="rounded-full">
          <Wordmark site={site} tone={tone} />
        </Link>
        <nav aria-label="Fő navigáció" className="flex items-center gap-1 text-sm font-semibold">
          {overlay && (
            <span className="hidden items-center gap-1 lg:flex">
              {[['#terek', 'A ház'], ['#galeria', 'Galéria'], ['#tudnivalok', 'Tudnivalók'], ['#gyik', 'GYIK']].map(([href, label]) => (
                <a key={href} href={href} className="rounded-full px-3 py-3 text-cream/90 hover:text-cream">{label}</a>
              ))}
            </span>
          )}
          <a
            href={sisterOrigin}
            className={`whitespace-nowrap rounded-full px-3 py-3 ${overlay ? 'text-cream/90 hover:text-cream' : 'text-deep hover:text-action'}`}
          >
            <span className="hidden sm:inline">Testvérházunk: </span>{sister.name} <span aria-hidden="true">↗</span>
          </a>
          {overlay && <a href="#foglalas" className="btn btn-primary btn-sm ml-1 hidden md:inline-flex">Foglalás</a>}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter({ listing, sisterOrigin }: { listing: Listing; sisterOrigin: string }) {
  const site = listing.slug
  const brand = BRANDS[site]
  const sister = BRANDS[site === 'velence' ? 'napsugar' : 'velence']
  const phone = listing.contactPhone ?? brand.phone
  const email = listing.contactEmail
  return (
    <footer className="bg-deep pb-24 text-cream md:pb-0">
      <RippleDivider tone="reed" className="opacity-30" />
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Wordmark site={site} tone="light" size={44} />
            <p className="mt-4 max-w-sm text-cream/80">{listing.tagline}</p>
            {listing.address && <p className="mt-3 text-cream/80">{listing.address}</p>}
          </div>
          <div>
            <h2 className="text-xl text-cream">Kapcsolat</h2>
            <ul className="mt-3 space-y-1">
              <li><a href={telHref(phone)} className="inline-block py-2 text-lg underline-offset-4 hover:underline">{phone}</a></li>
              {email && <li><a href={`mailto:${email}`} className="inline-block break-all py-2 underline-offset-4 hover:underline">{email}</a></li>}
              {listing.content.contact_hours && <li className="text-sm text-cream/75">Elérhetőség: {listing.content.contact_hours}</li>}
            </ul>
          </div>
          <div>
            <h2 className="text-xl text-cream">Testvérházunk</h2>
            <p className="mt-3 text-sm text-cream/80">{sister.fullName}</p>
            <a href={sisterOrigin} className="mt-2 inline-block py-2 font-semibold text-accent underline-offset-4 hover:underline">
              Megnézem <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-cream/15 pt-6 text-sm text-cream/75 md:flex-row md:items-center md:justify-between">
          <span>{listing.ntakId && <>NTAK: {listing.ntakId} · </>}© {new Date().getFullYear()} {brand.fullName}</span>
          <nav aria-label="Jogi információk" className="flex flex-wrap gap-x-5">
            <Link href="/adatvedelem" className="py-2 hover:text-cream">Adatkezelés</Link>
            <Link href="/aszf" className="py-2 hover:text-cream">ÁSZF és házirend</Link>
            <Link href="/sutik" className="py-2 hover:text-cream">Sütik</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
