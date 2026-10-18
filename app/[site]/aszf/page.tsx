import type { Metadata } from 'next'
import { LegalPage, loadLegal, Pending } from '@/components/property/LegalPage'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'ÁSZF és házirend',
  description: 'A foglalás menete, árak és fizetés, lemondás, házirend és panaszkezelés: a szálláshely általános szerződési feltételei.',
  alternates: { canonical: '/aszf' },
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site, listing } = await loadLegal(params)
  const contact = `${listing.contactPhone ?? ''}${listing.contactEmail ? `, ${listing.contactEmail}` : ''}`
  return (
    <LegalPage site={site} listing={listing} title="ÁSZF és házirend" path="/aszf">
      <h2>1. Szolgáltató</h2>
      <ul>
        <li>Üzemeltető neve, székhelye, adószáma: <Pending>üzemeltetői adatok</Pending></li>
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
      {site === 'napsugar' ? (
        <ul>
          <li>A teljes összeg legkésőbb az érkezés napján esedékes, forintban vagy euróban.</li>
          <li>Érkezéskor 80 000 Ft kaució fizetendő, amely károkozás hiányában maradéktalanul visszajár.</li>
          <li>Idegenforgalmi adó: 18 éves kor felett 800 Ft / fő / éj, a szálláshelyen fizetendő.</li>
          <li>A medence használata külön díjas lehet; fűtés és klíma használatakor fogyasztás szerinti energiadíj kerülhet felszámításra.</li>
        </ul>
      ) : (
        <p>Kaució és idegenforgalmi adó: <Pending>összeg és fizetési mód</Pending></p>
      )}

      <h2>4. Lemondás és elállás</h2>
      <p>Lemondási feltételek: <Pending>lemondási határidők és díjak</Pending></p>
      <p>
        A szálláshely-szolgáltatásra, ha a szerződés meghatározott időpontra vagy időszakra szól, a távollévők között kötött
        szerződésekre irányadó 14 napos indokolás nélküli elállási jog nem vonatkozik
        (45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés l) pont).
      </p>

      <h2>5. Házirend</h2>
      <ul>
        {listing.houseRules.map((r) => (
          <li key={r.t}><strong>{r.t}</strong>{r.d ? `: ${r.d}` : ''}</li>
        ))}
      </ul>
      {!listing.checkinWindow && <p>Érkezés és távozás időpontja: <Pending>érkezési és távozási időablak</Pending></p>}

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
