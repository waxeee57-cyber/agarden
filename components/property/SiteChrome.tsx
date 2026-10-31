import Link from 'next/link'
import type { Metadata } from 'next'
import { BRANDS, telHref } from '@/lib/brand'
import { SOCIAL_LABEL, socialEntries } from '@/lib/social'
import type { SiteCtx } from '@/lib/page'
import { Wordmark, Mark, Icon } from './ui'
import { SiteMenu } from './SiteMenu'
import { MobileStickyCTA } from './MobileStickyCTA'
import { JsonLd, breadcrumbJsonLd } from './JsonLd'

// Header, footer and page shell shared by every public page of both houses.
// The sister house is only ever an absolute link to ITS domain.

/** Phone, e-mail and the social links that are actually filled in. */
export function ContactLinks({ ctx, tone = 'page' }: { ctx: SiteCtx; tone?: 'page' | 'band' }) {
  const { listing } = ctx
  const social = socialEntries(listing.social)
  const ring = tone === 'band' ? 'border-band-fg/30 hover:border-band-fg' : 'border-rule hover:border-fg'
  return (
    <div className="flex flex-col gap-1">
      <a href={telHref(ctx.phone)} className="inline-flex min-h-11 items-center gap-3 font-semibold underline-offset-4 hover:underline">
        <Icon name="phone" /> {ctx.phone}
      </a>
      {listing.contactEmail && (
        <a href={`mailto:${listing.contactEmail}`} className="inline-flex min-h-11 items-center gap-3 break-all underline-offset-4 hover:underline">
          <Icon name="mail" /> {listing.contactEmail}
        </a>
      )}
      {listing.content.contact_hours && <p className="text-sm opacity-75">Telefonon: {listing.content.contact_hours}</p>}
      {social.length > 0 && (
        <ul className="mt-3 flex gap-2" aria-label="Közösségi oldalak">
          {social.map(([n, url]) => (
            <li key={n}>
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${BRANDS[listing.slug].fullName} a ${SOCIAL_LABEL[n]}-on (új lapon)`} className={`flex h-12 w-12 items-center justify-center rounded-full border ${ring}`}>
                <Icon name={n} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SiteHeader({ ctx, overlay = false }: { ctx: SiteCtx; overlay?: boolean }) {
  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-30' : 'border-b border-rule bg-bg'}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-5">
        <Link href="/" className="rounded-md" aria-label={`${BRANDS[ctx.site].fullName}, főoldal`}>
          <Wordmark site={ctx.site} size={40} />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/foglalas" className="btn btn-act btn-sm hidden md:inline-flex">Foglalás</Link>
          <SiteMenu items={ctx.nav} footer={<ContactLinks ctx={ctx} />} />
        </div>
      </div>
    </header>
  )
}

// Centered, quiet footer (reference structure): name, address, two contact
// circles, social, sister house, legal row.
export function SiteFooter({ ctx }: { ctx: SiteCtx }) {
  const { listing, site } = ctx
  const brand = BRANDS[site]
  const sister = BRANDS[site === 'velence' ? 'napsugar' : 'velence']
  const social = socialEntries(listing.social)
  const circle = 'flex h-12 w-12 items-center justify-center rounded-full border border-band-fg/30 transition-colors group-hover:border-band-fg'
  return (
    <footer className="bg-band pb-24 text-band-fg md:pb-0">
      <div className="mx-auto max-w-5xl px-5 pb-10 pt-16 text-center md:px-8 md:pt-24">
        <p className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">{brand.fullName}</p>
        {listing.address && <p className="mt-3 text-band-fg/80">{listing.address}</p>}
        {listing.ntakId && <p className="mt-1 text-sm text-band-fg/60">NTAK regisztrációs szám: {listing.ntakId}</p>}

        <div className="mx-auto mt-12 grid max-w-2xl gap-8 sm:grid-cols-2">
          <a href={telHref(ctx.phone)} className="group flex flex-col items-center gap-3">
            <span className={circle}><Icon name="phone" size={18} /></span>
            <span className="font-display text-xl">{ctx.phone}</span>
            {listing.content.contact_hours && <span className="-mt-2 text-xs text-band-fg/60">{listing.content.contact_hours}</span>}
          </a>
          {listing.contactEmail && (
            <a href={`mailto:${listing.contactEmail}`} className="group flex flex-col items-center gap-3">
              <span className={circle}><Icon name="mail" size={18} /></span>
              <span className="text-[1.02rem] [overflow-wrap:anywhere]">{listing.contactEmail}</span>
            </a>
          )}
        </div>

        {social.length > 0 && (
          <ul className="mt-10 flex justify-center gap-2" aria-label="Közösségi oldalak">
            {social.map(([n, url]) => (
              <li key={n}>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${brand.fullName} a ${SOCIAL_LABEL[n]}-on (új lapon)`} className="flex h-11 w-11 items-center justify-center rounded-full text-band-fg/80 hover:text-band-fg">
                  <Icon name={n} size={19} />
                </a>
              </li>
            ))}
          </ul>
        )}

        <a href={ctx.sisterOrigin} className="mt-8 inline-flex min-h-11 items-center gap-3 text-sm text-band-fg/85 hover:text-band-fg">
          <Mark site={sister.site} size={28} /> Testvérházunk: {sister.fullName} <span aria-hidden="true">↗</span>
        </a>

        <div className="mt-12 flex flex-col items-center gap-2 border-t border-band-fg/12 pt-6 text-xs text-band-fg/65 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} {brand.fullName}</span>
          <nav aria-label="Jogi információk" className="flex flex-wrap justify-center gap-x-5">
            <Link href="/adatvedelem" className="inline-flex min-h-11 items-center hover:text-band-fg">Adatvédelem</Link>
            <Link href="/sutik" className="inline-flex min-h-11 items-center hover:text-band-fg">Sütik</Link>
            <Link href="/aszf" className="inline-flex min-h-11 items-center hover:text-band-fg">ÁSZF</Link>
            {ctx.docs.hazirend && <Link href="/hazirend" className="inline-flex min-h-11 items-center hover:text-band-fg">Házirend</Link>}
          </nav>
        </div>
      </div>
    </footer>
  )
}

/** Shell for every public page: skin, header, breadcrumb JSON-LD, footer, mobile CTA. */
export function SitePage({ ctx, crumb, overlayHeader = false, sticky = true, children }: { ctx: SiteCtx; crumb?: { name: string; path: string }; overlayHeader?: boolean; sticky?: boolean; children: React.ReactNode }) {
  const trail = [{ name: BRANDS[ctx.site].fullName, path: '/' }, ...(crumb ? [crumb] : [])]
  return (
    <div data-skin={ctx.site} className="skin-root">
      <a href="#tartalom" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-3">Ugrás a tartalomhoz</a>
      {crumb && <JsonLd data={breadcrumbJsonLd(ctx.origin, trail)} />}
      <SiteHeader ctx={ctx} overlay={overlayHeader} />
      <main id="tartalom">{children}</main>
      <SiteFooter ctx={ctx} />
      {sticky && <MobileStickyCTA phone={ctx.phone} />}
    </div>
  )
}

/** Per-page metadata: own title, description and canonical. */
export function pageMeta(site: SiteCtx['site'], path: string, title: string, description: string): Metadata {
  const siteName = BRANDS[site].fullName
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'hu_HU', siteName, title: `${title} | ${siteName}`, description, url: path, images: [{ url: '/brand/og', width: 1200, height: 630, alt: siteName }] },
    twitter: { card: 'summary_large_image', title: `${title} | ${siteName}`, description, images: ['/brand/og'] },
  }
}

/** Page heading block used by the subpages. */
export function PageHead({ title, lead, kicker }: { title: string; lead?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 md:px-8 md:pb-14 md:pt-20">
      {kicker && <p className="kicker">{kicker}</p>}
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.8rem)]">{title}</h1>
      {lead && <div className="mt-4 max-w-[60ch] text-lg text-soft">{lead}</div>}
    </div>
  )
}
