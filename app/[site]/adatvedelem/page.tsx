import type { Metadata } from 'next'
import { LegalPage, loadLegal, Tbd } from '@/components/property/LegalPage'

export const revalidate = 3600
export const metadata: Metadata = { title: 'Adatkezelési tájékoztató', alternates: { canonical: '/adatvedelem' } }

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site, listing } = await loadLegal(params)
  return (
    <LegalPage site={site} listing={listing} title="Adatkezelési tájékoztató" path="/adatvedelem" updated="2026. október 14.">
      <h2>1. Adatkezelő</h2>
      <ul>
        <li>Név / cégnév: <Tbd>üzemeltető neve</Tbd></li>
        <li>Székhely: <Tbd>székhely</Tbd></li>
        <li>Adószám: <Tbd>adószám</Tbd></li>
        <li>Szálláshely: {listing.name}{listing.ntakId ? `, NTAK: ${listing.ntakId}` : ''}</li>
        <li>Kapcsolat: {listing.contactPhone}{listing.contactEmail ? `, ${listing.contactEmail}` : ''}</li>
      </ul>

      <h2>2. Milyen adatokat kezelünk</h2>
      <p>A foglalási kérelem és az ajánlatkérés űrlapján megadott adatokat: név, e-mail cím, telefonszám (opcionális), érkezés és távozás dátuma, létszám, kisállat és rendezvény jelzése, valamint az üzenet szövege.</p>

      <h2>3. Cél és jogalap</h2>
      <p>A foglalás vagy ajánlatkérés feldolgozása, visszaigazolása és a kapcsolattartás, a szerződés megkötését megelőző lépések érdekében (GDPR 6. cikk (1) b) pont). A szálláshely-szolgáltatással kapcsolatos jogszabályi kötelezettségek (pl. NTAK-adatszolgáltatás, idegenforgalmi adó) teljesítése (GDPR 6. cikk (1) c) pont).</p>

      <h2>4. Megőrzési idő</h2>
      <p><Tbd>megőrzési idő (pl. a tartózkodást követő X év, számviteli kötelezettség esetén a törvényi határidő)</Tbd></p>

      <h2>5. Adatfeldolgozók</h2>
      <ul>
        <li>Vercel Inc. – weboldal tárhely és futtatás (a szerveroldali feldolgozás Frankfurt régióban fut).</li>
        <li>Neon (Databricks) – adatbázis, Frankfurt (eu-central-1) régió.</li>
        <li>Vercel Blob – a házról készült fotók tárolása (személyes adatot nem tartalmaz).</li>
        <li>Resend – visszaigazoló e-mailek küldése, ha be van kapcsolva.</li>
        <li>OpenStreetMap – a térkép csempéit a böngésződ közvetlenül tölti le (ehhez az IP-címed az OSM szervereihez jut).</li>
      </ul>

      <h2>6. Jogaid</h2>
      <p>Kérhetsz hozzáférést az adataidhoz, helyesbítést, törlést, az adatkezelés korlátozását, és tiltakozhatsz az adatkezelés ellen. Kérésedet a fenti elérhetőségeken jelezd. Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH, 1055 Budapest, Falk Miksa utca 9–11., <a href="https://naih.hu">naih.hu</a>) fordulhatsz.</p>

      <h2>7. Online fizetés</h2>
      <p>Az oldalon nincs online fizetés, bankkártya-adatot nem kérünk és nem tárolunk.</p>
    </LegalPage>
  )
}
