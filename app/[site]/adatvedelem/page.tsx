import type { Metadata } from 'next'
import { LegalPage, loadLegal, Pending } from '@/components/property/LegalPage'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'Milyen adatot kérünk a foglaláshoz, mire használjuk, meddig őrizzük, ki fér hozzá, és milyen jogaid vannak (GDPR).',
  alternates: { canonical: '/adatvedelem' },
}

// GDPR Art. 13 checklist: controller, purposes + legal basis, recipients,
// third-country transfer, retention, rights, complaint authority, whether the
// data is required, automated decision-making. Unknown operator data = Pending.
export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site, listing } = await loadLegal(params)
  void site
  return (
    <LegalPage site={site} listing={listing} title="Adatkezelési tájékoztató" path="/adatvedelem">
      <h2>1. Adatkezelő</h2>
      <ul>
        <li>Név, székhely, adószám: <Pending>üzemeltetői adatok</Pending></li>
        <li>Szálláshely: {listing.name}{listing.ntakId ? `, NTAK: ${listing.ntakId}` : ''}</li>
        <li>Kapcsolat adatkezelési ügyekben: {listing.contactPhone}{listing.contactEmail ? `, ${listing.contactEmail}` : ''}</li>
      </ul>

      <h2>2. Milyen adatokat kezelünk</h2>
      <ul>
        <li><strong>Foglalási kérelem és ajánlatkérés:</strong> név, e-mail cím, telefonszám (nem kötelező), érkezés és távozás dátuma, létszám, kisállat és rendezvény jelzése, az üzenet szövege.</li>
        <li><strong>Visszaélés-megelőzés:</strong> az IP-címből képzett számláló a túl sok egymás utáni kérés kiszűrésére. Legfeljebb 24 óráig őrizzük.</li>
        <li><strong>Technikai naplók:</strong> a tárhelyszolgáltató a működéshez rövid ideig naplózza a kéréseket (pl. IP-cím, időpont, elért oldal).</li>
      </ul>
      <p>Az oldal látogatóként nem használ sütit, analitikát vagy hirdetési követést (lásd: Sütik).</p>

      <h2>3. Cél és jogalap</h2>
      <ul>
        <li>A foglalás vagy ajánlatkérés feldolgozása, visszaigazolása és a kapcsolattartás: a szerződés megkötését megelőző lépések, illetve a szerződés teljesítése (GDPR 6. cikk (1) b) pont).</li>
        <li>A szálláshely-szolgáltatáshoz kapcsolódó jogszabályi kötelezettségek (pl. NTAK-adatszolgáltatás, idegenforgalmi adó): jogi kötelezettség (GDPR 6. cikk (1) c) pont).</li>
        <li>Visszaélés-megelőzés és a rendszer biztonsága: jogos érdek (GDPR 6. cikk (1) f) pont).</li>
      </ul>
      <p>Az adatok megadása önkéntes, de név és e-mail cím nélkül nem tudjuk a kérést visszaigazolni. Automatizált döntéshozatal és profilalkotás nem történik.</p>

      <h2>4. Megőrzési idő</h2>
      <p>Foglalási és ajánlatkérési adatok: <Pending>megőrzési idő (pl. a tartózkodást követő időszak; számviteli bizonylatnál a törvényi határidő)</Pending>. A tulajdonos a nem teljesült kéréseket a kezelőfelületről bármikor törölheti.</p>

      <h2>5. Ki fér hozzá az adatokhoz</h2>
      <p>Az adatokat csak a szálláshely tulajdonosa látja, jelszóval védett kezelőfelületen. Adatfeldolgozók:</p>
      <ul>
        <li>Vercel Inc. – weboldal tárhely és futtatás; a szerveroldali feldolgozás a frankfurti régióban fut.</li>
        <li>Neon (Databricks) – adatbázis, frankfurti (eu-central-1) régió.</li>
        <li>Resend – visszaigazoló e-mailek küldése, ha be van kapcsolva.</li>
      </ul>
      <p>
        Az adatokat az Európai Unióban tároljuk. Mivel a szolgáltatók anyavállalata az Egyesült Államokban működik,
        harmadik országba történő hozzáférés az adatfeldolgozói szerződésekben rögzített garanciák mellett lehetséges
        (pl. az Európai Bizottság általános szerződési feltételei). <Pending>a garanciák tulajdonosi ellenőrzése</Pending>
      </p>
      <p>A Napsugár oldalán a térkép csempéit a böngésződ közvetlenül az OpenStreetMap szervereiről tölti le; ehhez az IP-címed az OSM-hez jut. Az OSM nem a mi adatfeldolgozónk.</p>

      <h2>6. Jogaid</h2>
      <p>
        Kérhetsz hozzáférést az adataidhoz, helyesbítést, törlést, az adatkezelés korlátozását, adathordozhatóságot,
        és tiltakozhatsz a jogos érdeken alapuló adatkezelés ellen. Kérésedre legfeljebb egy hónapon belül válaszolunk.
        Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz fordulhatsz (NAIH, 1055 Budapest, Falk Miksa utca 9–11.,{' '}
        <a href="https://naih.hu">naih.hu</a>), vagy bírósághoz.
      </p>

      <h2>7. Online fizetés</h2>
      <p>Az oldalon nincs online fizetés, bankkártyaadatot nem kérünk és nem tárolunk.</p>
    </LegalPage>
  )
}
