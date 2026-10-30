import Link from 'next/link'
import { LegalPage, loadLegal, Pending, ConsumerSupplement } from '@/components/property/LegalPage'
import { SitePage, pageMeta } from '@/components/property/SiteChrome'
import { DocBody } from '@/components/property/DocPage'
import { lines, operatorLine } from '@/lib/legal'
import { loadSite } from '@/lib/page'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  return pageMeta(ctx.site, '/aszf', 'Általános szerződési feltételek', 'A foglalás menete, előleg és fizetés, lemondás és panaszkezelés: a szálláshely általános szerződési feltételei.')
}

// The owner's own ÁSZF (admin "Szövegek") wins; until there is one, the page is
// generated from the "Adatok" fields with visible "pótlásra vár" gaps.
export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { listing, ctx } = await loadLegal(params)
  const contact = `${listing.contactPhone ?? ''}${listing.contactEmail ? `, ${listing.contactEmail}` : ''}`
  const doc = ctx.docs.aszf
  if (doc) {
    return (
      <SitePage ctx={ctx} crumb={{ name: 'ÁSZF', path: '/aszf' }}>
        <DocBody title="Általános szerződési feltételek" body={doc.body} effective={doc.effectiveDate} updated={doc.updatedAt} />
        <ConsumerSupplement contact={contact} />
      </SitePage>
    )
  }
  const legal = listing.legal
  const operator = operatorLine(legal)
  const payment = lines(legal.paymentTerms)
  const cancellation = lines(legal.cancellation)
  return (
    <LegalPage ctx={ctx} title="Általános szerződési feltételek" path="/aszf">
      <h2>1. Szolgáltató</h2>
      <ul>
        <li>Üzemeltető: {operator ?? <Pending>üzemeltetői adatok (név, székhely, adószám)</Pending>}</li>
        <li>Szálláshely: {listing.name}{listing.address ? `, ${listing.address}` : ''}</li>
        {listing.ntakId && <li>NTAK regisztrációs szám: {listing.ntakId}</li>}
        <li>Kapcsolat: {contact}</li>
      </ul>

      <h2>2. A foglalás menete</h2>
      <p>
        Az oldalon leadott foglalás <strong>foglalási kérelem</strong>: a kiválasztott dátumokat a visszaigazolásig fenntartjuk.
        A szerződés akkor jön létre, amikor a szálláshely a foglalást e-mailben visszaigazolja. Az ajánlatkérés nem foglal le dátumot.
        Az oldalon nincs online fizetés, bankkártyaadatot nem kérünk.
      </p>

      <h2>3. Árak és fizetés</h2>
      <p>Az árat egyedi ajánlatban vagy a visszaigazolásban közöljük. Fizetés a helyszínen.</p>
      {payment.length > 0 ? (
        <ul>{payment.map((l, i) => <li key={i}>{l}</li>)}</ul>
      ) : (
        <p>Kaució és idegenforgalmi adó: <Pending>összeg és fizetési mód</Pending></p>
      )}

      <h2>4. Lemondás és elállás</h2>
      {cancellation.length > 0 ? (
        <ul>{cancellation.map((l, i) => <li key={i}>{l}</li>)}</ul>
      ) : (
        <p>Lemondási feltételek: <Pending>lemondási határidők és díjak</Pending></p>
      )}
      <p>
        A szálláshely-szolgáltatásra, ha a szerződés meghatározott időpontra vagy időszakra szól, a távollévők között kötött
        szerződésekre irányadó 14 napos indokolás nélküli elállási jog nem vonatkozik
        (45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés l) pont).
      </p>

      <h2>5. Házirend</h2>
      {ctx.docs.hazirend && <p>A részletes házirend külön oldalon olvasható: <Link href="/hazirend">Házirend</Link>.</p>}
      {listing.checkinWindow && listing.checkoutTime ? (
        <p>Érkezés: {listing.checkinWindow}. Távozás: {listing.checkoutTime}-ig.</p>
      ) : (
        <p>Érkezés és távozás időpontja: <Pending>érkezési és távozási időablak</Pending></p>
      )}

      <h2>6. Panaszkezelés, jogorvoslat</h2>
      <p>Panaszodat elsősorban közvetlenül nekünk jelezd: {contact}.</p>
      <p>
        Fogyasztói jogvita esetén a lakóhelyed szerinti, vagy a szálláshely szerint illetékes békéltető testülethez fordulhatsz:
      </p>
      <ul>
        <li>
          Fejér Vármegyei Békéltető Testület, 8000 Székesfehérvár, Hosszúsétatér 4–6.; telefon: (22) 510-310;
          e-mail: <a href="mailto:bekeltetes@fmkik.hu">bekeltetes@fmkik.hu</a>; <a href="https://www.bekeltetesfejer.hu">bekeltetesfejer.hu</a>
        </li>
      </ul>
    </LegalPage>
  )
}
