import { LegalPage, loadLegal, Pending } from '@/components/property/LegalPage'
import { SitePage, pageMeta } from '@/components/property/SiteChrome'
import { DocBody } from '@/components/property/DocPage'
import { operatorLine } from '@/lib/legal'
import { loadSite } from '@/lib/page'

export const revalidate = 86400 // content changes revalidate on save (admin); this is only a safety net

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  return pageMeta(ctx.site, '/adatvedelem', 'Adatkezelési tájékoztató', 'Milyen adatot kérünk a foglaláshoz, mire használjuk, meddig őrizzük, ki fér hozzá, és milyen jogai vannak (GDPR).')
}

// GDPR Art. 13 checklist: controller, purposes + legal basis, recipients,
// third-country transfer, retention, rights, complaint authority, whether the
// data is required, automated decision-making. Unknown operator data = Pending.
export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { listing, ctx } = await loadLegal(params)
  const operator = operatorLine(listing.legal)
  const doc = ctx.docs.adatvedelem
  const technical = <TechnicalNotice listing={listing} operator={operator} heading={doc ? 'h3' : 'h2'} />
  if (doc) {
    // The owner's own notice first; the website's processing (booking system,
    // processors, retention) follows as a supplement, since the owner's text predates it.
    return (
      <SitePage ctx={ctx} crumb={{ name: 'Adatvédelem', path: '/adatvedelem' }}>
        <DocBody title="Adatkezelési tájékoztató" body={doc.body} effective={doc.effectiveDate} updated={doc.updatedAt} />
        <section className="prose-legal mx-auto max-w-6xl px-5 pb-20 md:px-8 lg:pl-[calc(220px+4rem+2rem)]" aria-labelledby="honlap">
          <div className="max-w-[70ch] border-t border-rule pt-8">
            <h2 id="honlap" className="!mt-0">Kiegészítés: a honlap foglalási rendszerének adatkezelése</h2>
            {technical}
          </div>
        </section>
      </SitePage>
    )
  }
  return (
    <LegalPage ctx={ctx} title="Adatkezelési tájékoztató" path="/adatvedelem">
      {technical}
    </LegalPage>
  )
}

function TechnicalNotice({ listing, operator, heading: H }: { listing: Awaited<ReturnType<typeof loadLegal>>['listing']; operator: string | null; heading: 'h2' | 'h3' }) {
  return (
    <>
      <H>1. Adatkezelő</H>
      <ul>
        <li>Adatkezelő: {operator ?? <Pending>üzemeltetői adatok (név, székhely, adószám)</Pending>}</li>
        <li>Szálláshely: {listing.name}{listing.ntakId ? `, NTAK: ${listing.ntakId}` : ''}</li>
        <li>Kapcsolat adatkezelési ügyekben: {listing.contactPhone}{listing.contactEmail ? `, ${listing.contactEmail}` : ''}</li>
      </ul>

      <H>2. Milyen adatokat kezelünk</H>
      <ul>
        <li><strong>Foglalási kérelem és ajánlatkérés:</strong> név, e-mail cím, telefonszám (nem kötelező), érkezés és távozás dátuma, létszám, kisállat és rendezvény jelzése, az üzenet szövege.</li>
        <li><strong>Kapcsolati üzenet:</strong> név, e-mail cím, telefonszám (nem kötelező), az üzenet szövege. 90 nap után automatikusan töröljük.</li>
        <li><strong>Visszaélés-megelőzés:</strong> az IP-címből képzett számláló a túl sok egymás utáni kérés kiszűrésére. Legfeljebb 24 óráig őrizzük.</li>
        <li><strong>Technikai naplók:</strong> a tárhelyszolgáltató a működéshez rövid ideig naplózza a kéréseket (pl. IP-cím, időpont, elért oldal).</li>
      </ul>
      <p>Az oldal látogatóként nem használ sütit, analitikát vagy hirdetési követést (lásd: Sütik).</p>

      <H>3. Cél és jogalap</H>
      <ul>
        <li>A foglalás vagy ajánlatkérés feldolgozása, visszaigazolása és a kapcsolattartás: a szerződés megkötését megelőző lépések, illetve a szerződés teljesítése (GDPR 6. cikk (1) b) pont).</li>
        <li>A szálláshely-szolgáltatáshoz kapcsolódó jogszabályi kötelezettségek (pl. NTAK-adatszolgáltatás, idegenforgalmi adó): jogi kötelezettség (GDPR 6. cikk (1) c) pont).</li>
        <li>Visszaélés-megelőzés és a rendszer biztonsága: jogos érdek (GDPR 6. cikk (1) f) pont).</li>
      </ul>
      <p>Az adatok megadása önkéntes, de név és e-mail cím nélkül nem tudjuk a kérést visszaigazolni. Automatizált döntéshozatal és profilalkotás nem történik.</p>

      <H>4. Megőrzési idő</H>
      <p>Foglalási és ajánlatkérési adatok: {listing.legal.retention ?? <Pending>megőrzési idő</Pending>}{listing.legal.retention && !/[.!?]$/.test(listing.legal.retention) ? '.' : ''} A tulajdonos a nem teljesült kéréseket a kezelőfelületről bármikor törölheti.</p>

      <H>5. Ki fér hozzá az adatokhoz</H>
      <p>Az adatokat csak a szálláshely tulajdonosa látja, jelszóval védett kezelőfelületen. Adatfeldolgozók:</p>
      <ul>
        <li>Vercel Inc. – weboldal tárhely és futtatás; a szerveroldali feldolgozás a frankfurti régióban fut.</li>
        <li>Neon (Databricks) – adatbázis, frankfurti (eu-central-1) régió.</li>
        {process.env.SMTP_USER
          ? <li>Google Ireland Ltd. (Gmail) – a visszaigazoló és értesítő e-maileket a szálláshely saját Gmail-fiókja küldi.</li>
          : <li>Resend (Plus Five Five, Inc.) – a visszaigazoló és értesítő e-mailek kézbesítése, EU (Írország, eu-west-1) régióból.</li>}
      </ul>
      <p>
        Az adatokat az Európai Unióban tároljuk. Mivel a szolgáltatók anyavállalata az Egyesült Államokban működik,
        harmadik országba történő hozzáférés az adatfeldolgozói szerződésekben rögzített garanciák mellett lehetséges
        (pl. az Európai Bizottság általános szerződési feltételei).{!listing.legal.processorsConfirmed && <> <Pending>a garanciák tulajdonosi ellenőrzése</Pending></>}
      </p>
      <p>A Kapcsolat oldalon a térkép csempéit az Ön böngészője közvetlenül az OpenStreetMap szervereiről tölti le; ehhez az IP-címe az OSM-hez jut. Az OSM nem a mi adatfeldolgozónk.</p>

      <H>6. Az Ön jogai</H>
      <p>
        Kérhet hozzáférést az adataihoz, helyesbítést, törlést, az adatkezelés korlátozását, adathordozhatóságot,
        és tiltakozhat a jogos érdeken alapuló adatkezelés ellen. Kérésére legfeljebb egy hónapon belül válaszolunk.
        Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz fordulhat (NAIH, 1055 Budapest, Falk Miksa utca 9–11.,{' '}
        <a href="https://naih.hu">naih.hu</a>), vagy bírósághoz.
      </p>

      <H>7. Online fizetés</H>
      <p>Az oldalon nincs online fizetés, bankkártyaadatot nem kérünk és nem tárolunk.</p>
    </>
  )
}
