import type { Metadata } from 'next'
import { LegalPage, loadLegal } from '@/components/property/LegalPage'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Sütik',
  description: 'Látogatóként nem használunk sütit, analitikát vagy hirdetési követést. Egyetlen süti van: a tulajdonosi belépésé.',
  alternates: { canonical: '/sutik' },
}

// Claims below were measured on 2026-10-18: a live crawl of every public page
// set no cookies and made no third-party requests; OSM tile responses carry no
// Set-Cookie header.
export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site, listing } = await loadLegal(params)
  return (
    <LegalPage site={site} listing={listing} title="Sütik (cookie-k)" path="/sutik">
      <h2>Látogatóként</h2>
      <p>Az oldal a látogatóknál <strong>nem használ sütit</strong>: nincs analitika, nincs hirdetési vagy követő süti, ezért süti-hozzájárulást sem kérünk. A betűtípusokat is saját szerverünkről töltjük, nem külső szolgáltatótól.</p>
      {site === 'napsugar' && <p>A térkép az OpenStreetMap csempéit tölti be; ezek sem helyeznek el sütit.</p>}

      <h2>A tulajdonosi felületen</h2>
      <table>
        <thead><tr><th className="pr-6 text-left">Név</th><th className="pr-6 text-left">Cél</th><th className="text-left">Lejárat</th></tr></thead>
        <tbody>
          <tr><td className="pr-6 align-top"><code>ag_admin</code></td><td className="pr-6 align-top">Bejelentkezés megtartása a tulajdonosi felületen (feltétlenül szükséges)</td><td className="align-top">7 nap</td></tr>
        </tbody>
      </table>
      <p>Ez a süti csak a tulajdonos bejelentkezésekor jön létre, és csak ezen a domainen érvényes.</p>
    </LegalPage>
  )
}
