import type { Site } from '@/lib/site-map'
import type { Listing } from '@/lib/listing'
import { loadSite, type SiteCtx } from '@/lib/page'
import { huDate, missingLegal } from '@/lib/legal'
import { SitePage } from './SiteChrome'

// Shared shell for the generated legal pages (used when the owner has not
// written their own document). Operator data the owner has not given us is
// shown as a visible "pótlásra vár" marker — never guessed.

export function Pending({ children }: { children: React.ReactNode }) {
  return <span className="tbd">pótlásra vár: {children}</span>
}

export async function loadLegal(params: Promise<{ site: string }>): Promise<{ site: Site; listing: Listing; ctx: SiteCtx }> {
  const ctx = await loadSite((await params).site)
  return { site: ctx.site, listing: ctx.listing, ctx }
}

export const LEGAL_UPDATED = '2026. október 30.'

export function LegalPage({ ctx, title, path, children }: { ctx: SiteCtx; title: string; path: string; children: React.ReactNode }) {
  const { listing } = ctx
  return (
    <SitePage ctx={ctx} crumb={{ name: title, path }}>
      <article className="prose-legal mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-[clamp(2.4rem,6vw,4.2rem)]">{title}</h1>
        <p className="mt-3 text-sm text-soft">
          Hatályos: {listing.legal.updatedAt && listing.legal.updatedAt > '2026-10-30' ? huDate(listing.legal.updatedAt) : LEGAL_UPDATED}
          {missingLegal(listing.legal, listing).length > 0 && ' A kiemelt üzemeltetői adatok a tulajdonos megerősítése után kerülnek be.'}
        </p>
        {children}
      </article>
    </SitePage>
  )
}

/** Legally required consumer information shown under an owner-written ÁSZF. */
export function ConsumerSupplement({ contact }: { contact: string }) {
  return (
    <section className="doc mx-auto max-w-7xl px-4 pb-20 md:px-8 lg:pl-[calc(240px+4rem+2rem)]" aria-labelledby="kiegeszites">
      <div className="max-w-[70ch] border-t border-rule pt-8">
        <h2 id="kiegeszites" className="!mt-0">Kiegészítő tájékoztatás</h2>
        <p>
          A honlapon leadott foglalás foglalási kérelem: a szerződés a szálláshely írásos visszaigazolásával jön létre.
          Az oldalon nincs online fizetés, bankkártyaadatot nem kérünk.
        </p>
        <p>
          A szálláshely-szolgáltatásra, ha a szerződés meghatározott időpontra vagy időszakra szól, a távollévők között kötött
          szerződésekre irányadó 14 napos indokolás nélküli elállási jog nem vonatkozik (45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés l) pont).
        </p>
        <p>
          Panaszodat elsősorban közvetlenül nekünk jelezd: {contact}. Fogyasztói jogvita esetén a lakóhelyed szerinti, vagy a szálláshely szerint
          illetékes békéltető testülethez fordulhatsz: Fejér Vármegyei Békéltető Testület, 8000 Székesfehérvár, Hosszúsétatér 4–6.; telefon: (22) 510-310;
          e-mail: <a href="mailto:bekeltetes@fmkik.hu">bekeltetes@fmkik.hu</a>; <a href="https://www.bekeltetesfejer.hu">bekeltetesfejer.hu</a>
        </p>
      </div>
    </section>
  )
}
