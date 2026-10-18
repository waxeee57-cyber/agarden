import Link from 'next/link'
import type { Site } from '@/lib/site-map'
import { BRANDS, telHref } from '@/lib/brand'
import type { Listing } from '@/lib/listing'
import { Wordmark, Mark } from './ui'

// Header + footer for every public page of a house, in that house's skin.
// The sister house is only ever an absolute link to ITS domain.

export function SiteHeader({ site, sisterOrigin, nav = [], overlay = false }: { site: Site; sisterOrigin: string; nav?: [string, string][]; overlay?: boolean }) {
  const sisterSite: Site = site === 'velence' ? 'napsugar' : 'velence'
  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-30' : 'border-b border-rule bg-bg'}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" className="rounded-full">
          <Wordmark site={site} />
        </Link>
        <nav aria-label="Fő navigáció" className="flex items-center gap-1 text-sm font-semibold">
          {nav.length > 0 && (
            <span className="hidden items-center gap-1 lg:flex">
              {nav.map(([href, label]) => (
                <a key={href} href={href} className="rounded-full px-3 py-3 text-fg/85 hover:text-fg">{label}</a>
              ))}
            </span>
          )}
          <a href={sisterOrigin} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-fg/85 hover:text-fg">
            <Mark site={sisterSite} size={22} />
            <span><span className="hidden sm:inline">Testvérház: </span>{BRANDS[sisterSite].name}</span>
          </a>
          <Link href={overlay ? '#foglalas' : '/#foglalas'} className="btn btn-act btn-sm ml-1 hidden md:inline-flex">Szabad dátumok</Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter({ listing, sisterOrigin }: { listing: Listing; sisterOrigin: string }) {
  const site = listing.slug
  const brand = BRANDS[site]
  const sisterSite: Site = site === 'velence' ? 'napsugar' : 'velence'
  const phone = listing.contactPhone ?? brand.phone
  const email = listing.contactEmail
  return (
    <footer className="border-t border-rule bg-band-2 pb-24 text-band-2-fg md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="[&_.text-fg]:text-band-2-fg [&_.text-soft]:text-band-2-fg/75"><Wordmark site={site} size={44} /></span>
            {listing.address && <p className="mt-5 opacity-85">{listing.address}</p>}
            {listing.ntakId && <p className="mt-1 text-sm opacity-75">NTAK: {listing.ntakId}</p>}
          </div>
          <div>
            <h2 className="text-2xl">Kapcsolat</h2>
            <ul className="mt-3 space-y-1">
              <li><a href={telHref(phone)} className="inline-block py-2 text-lg font-semibold underline-offset-4 hover:underline">{phone}</a></li>
              {email && <li><a href={`mailto:${email}`} className="inline-block break-all py-2 underline-offset-4 hover:underline">{email}</a></li>}
              {listing.content.contact_hours && <li className="text-sm opacity-75">Elérhetőség: {listing.content.contact_hours}</li>}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl">Testvérház</h2>
            <a href={sisterOrigin} className="mt-3 inline-flex items-center gap-3 py-2 font-semibold underline-offset-4 hover:underline">
              <Mark site={sisterSite} size={34} /> {BRANDS[sisterSite].fullName} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-current/15 pt-6 text-sm opacity-80 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {brand.fullName}</span>
          <nav aria-label="Jogi információk" className="flex flex-wrap gap-x-5">
            <Link href="/adatvedelem" className="py-2 hover:underline">Adatkezelés</Link>
            <Link href="/aszf" className="py-2 hover:underline">ÁSZF és házirend</Link>
            <Link href="/sutik" className="py-2 hover:underline">Sütik</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
