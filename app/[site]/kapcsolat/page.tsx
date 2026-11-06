import { loadSite } from '@/lib/page'
import { BRANDS, telHref } from '@/lib/brand'
import { SOCIAL_LABEL, socialEntries } from '@/lib/social'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { ContactForm } from '@/components/property/ContactForm'
import { LocationMap } from '@/components/property/LocationMap'
import { Icon } from '@/components/property/ui'

export const revalidate = 86400 // content changes revalidate on save (admin); this is only a safety net

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const where = ctx.listing.address ?? 'Velence'
  return pageMeta(ctx.site, '/kapcsolat', 'Kapcsolat és megközelítés', `${BRANDS[ctx.site].fullName}: ${where}. Telefon: ${ctx.phone}. Írjon üzenetet, vagy nézze meg a térképen.`)
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const { listing } = ctx
  // Directions by the written address (more precise than our street-level pin).
  const social = socialEntries(listing.social)
  const route = listing.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(listing.address)}` : null
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Kapcsolat', path: '/kapcsolat' }}>
      <PageHead title="Kapcsolat" lead="Hívjon, írjon, vagy küldjön üzenetet: hamarosan válaszolunk." />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 md:px-8 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
        {/* The reference leads with a full-colour contact panel (large icons,
            bold lines). Ours: the house accent, every line a real link. */}
        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--radius-lg)] bg-deep p-7 text-deep-fg md:p-9">
            <h2 className="text-[clamp(1.6rem,3vw,2.1rem)] text-deep-fg">Elérhetőségek</h2>
            <ul className="mt-7 space-y-6">
              <li>
                <a href={telHref(ctx.phone)} className="group flex items-center gap-4">
                  <Ring><Icon name="phone" size={22} /></Ring>
                  <span>
                    <Label>Telefon{listing.content.contact_hours ? ` · ${listing.content.contact_hours}` : ''}</Label>
                    <span className="block text-[1.2rem] font-semibold text-deep-fg underline-offset-4 group-hover:underline">{ctx.phone}</span>
                  </span>
                </a>
              </li>
              {listing.contactEmail && (
                <li>
                  <a href={`mailto:${listing.contactEmail}`} className="group flex items-center gap-4">
                    <Ring><Icon name="mail" size={22} /></Ring>
                    <span className="min-w-0">
                      <Label>E-mail</Label>
                      <span className="block break-all text-[1.05rem] font-semibold text-deep-fg underline-offset-4 group-hover:underline">{listing.contactEmail}</span>
                    </span>
                  </a>
                </li>
              )}
              {listing.address && (
                <li className="flex items-start gap-4">
                  <Ring><Icon name="pin" size={22} /></Ring>
                  <span>
                    <Label>Cím</Label>
                    <span className="block text-[1.05rem] font-semibold text-deep-fg">{listing.address}</span>
                    {route && (
                      <a href={route} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-2 text-deep-fg/85 underline underline-offset-4 hover:text-deep-fg">
                        Útvonaltervezés <Icon name="out" size={16} />
                      </a>
                    )}
                  </span>
                </li>
              )}
            </ul>
            {social.length > 0 && (
              <ul className="mt-7 flex gap-2 border-t border-deep-fg/20 pt-6" aria-label="Közösségi oldalak">
                {social.map(([n, url]) => (
                  <li key={n}>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${BRANDS[ctx.site].fullName} a ${SOCIAL_LABEL[n]}-on (új lapon)`} className="flex h-12 w-12 items-center justify-center rounded-full border border-deep-fg/35 hover:border-deep-fg">
                      <Icon name={n} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {listing.ntakId && <p className="text-sm text-soft">NTAK regisztrációs szám: {listing.ntakId}</p>}
        </div>
        <div>
          <h2 className="mb-4 text-[clamp(1.6rem,3vw,2.2rem)]">Írjon nekünk</h2>
          <ContactForm phone={ctx.phone} />
        </div>
      </div>
      <section aria-label="Tudnivalók" className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 md:grid-cols-2 md:px-8">
        {(listing.checkinWindow || listing.checkoutTime) && (
          <div className="flex gap-4 border-t border-rule pt-6">
            <Icon name="calendar" size={36} stroke={1.35} className="shrink-0 text-fg/80" />
            <div>
              <h2 className="text-[1.4rem]">Érkezés, távozás</h2>
              <p className="mt-2 text-soft">
                {listing.checkinWindow && <>Érkezés: {listing.checkinWindow}. </>}
                {listing.checkoutTime && <>Távozás: {listing.checkoutTime}-ig. </>}
                Korábbi érkezést vagy későbbi távozást kérjük, előre egyeztesse velünk.
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-4 border-t border-rule pt-6">
          <Icon name="phone" size={36} stroke={1.35} className="shrink-0 text-fg/80" />
          <div>
            <h2 className="text-[1.4rem]">Segítünk</h2>
            <p className="mt-2 text-soft">
              Kérdése van a foglalással vagy az érkezéssel kapcsolatban? Hívjon minket{listing.content.contact_hours ? ` (${listing.content.contact_hours})` : ''}: {ctx.phone}.
            </p>
          </div>
        </div>
      </section>
      {listing.geo && (
        <section aria-label="Térkép" className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <div className="h-[360px] overflow-hidden rounded-[var(--radius-xl)] border border-rule md:h-[440px]">
            <LocationMap lat={listing.geo.lat} lng={listing.geo.lng} label={BRANDS[ctx.site].fullName} color={BRANDS[ctx.site].colors.action} />
          </div>
          {listing.address && <p className="mt-2 text-xs text-soft">A jelölő az utca szintjén pontos; a pontos cím: {listing.address.replace(/\.$/, '')}.</p>}
        </section>
      )}
    </SitePage>
  )
}

const Ring = ({ children }: { children: React.ReactNode }) => (
  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-deep-fg/12">{children}</span>
)
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="block font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-deep-fg/75">{children}</span>
)
