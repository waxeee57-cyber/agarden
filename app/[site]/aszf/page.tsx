import type { Metadata } from 'next'
import { LegalPage, loadLegal, Tbd } from '@/components/property/LegalPage'

export const revalidate = 3600
export const metadata: Metadata = { title: 'ÁSZF és házirend', alternates: { canonical: '/aszf' } }

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site, listing } = await loadLegal(params)
  return (
    <LegalPage site={site} listing={listing} title="ÁSZF és házirend" path="/aszf" updated="2026. október 14.">
      <h2>1. Szolgáltató</h2>
      <ul>
        <li>Üzemeltető: <Tbd>üzemeltető neve, székhelye, adószáma</Tbd></li>
        <li>Szálláshely: {listing.name}{listing.address ? `, ${listing.address}` : ''}</li>
        {listing.ntakId && <li>NTAK regisztrációs szám: {listing.ntakId}</li>}
      </ul>

      <h2>2. A foglalás menete</h2>
      <p>Az oldalon leadott foglalás <strong>foglalási kérelem</strong>: a kiválasztott dátumokat a visszaigazolásig fenntartjuk. A szerződés a szálláshely e-mailes visszaigazolásával jön létre. Az ajánlatkérés nem foglal le dátumot. Online nem vonunk le pénzt.</p>

      <h2>3. Árak és fizetés</h2>
      <p>Az árat egyedi ajánlatban vagy a visszaigazolásban közöljük. Fizetés a helyszínen.{site === 'napsugar' ? ' A teljes összeg legkésőbb az érkezés napján esedékes, forintban vagy euróban. Érkezéskor 80 000 Ft kaució fizetendő, amely károkozás hiányában maradéktalanul visszajár. Az idegenforgalmi adó 18 éves kor felett 800 Ft / fő / éj, a szálláshelyen fizetendő.' : ''}</p>
      {site === 'velence' && <p>Kaució, idegenforgalmi adó: <Tbd>összeg és fizetési mód</Tbd></p>}

      <h2>4. Lemondás</h2>
      <p><Tbd>lemondási feltételek</Tbd></p>

      <h2>5. Házirend</h2>
      <ul>
        {listing.houseRules.map((r) => (
          <li key={r.t}><strong>{r.t}</strong>{r.d ? `: ${r.d}` : ''}</li>
        ))}
      </ul>
      {!listing.checkinWindow && <p>Érkezés és távozás időpontja: <Tbd>check-in / check-out</Tbd></p>}

      <h2>6. Panaszkezelés</h2>
      <p>Panaszodat a {listing.contactPhone} telefonszámon{listing.contactEmail ? ` vagy a ${listing.contactEmail} címen` : ''} jelezheted. Békéltető testület: <Tbd>illetékes békéltető testület</Tbd></p>
    </LegalPage>
  )
}
