import type { Metadata } from 'next'
import { getVelenceListing } from '@/lib/velence'
import { getVelenceGallery } from '@/lib/gallery'
import { BookingWidget } from '@/components/velence/BookingWidget'
import { Gallery } from '@/components/velence/Gallery'
import { Reveal } from '@/components/velence/Reveal'
import { RippleDivider, WaxSeal } from '@/components/velence/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Velence — egyben bérelhető nyaraló a tó déli partján',
  description:
    'Garden Vendégház Velence: az egész ház a tiétek, max 10+2 fő. 6 fős jakuzzi, 2 fős szauna, fedett terasz, kert grillel, ingyenes parkolás. Foglalj online vagy kérj ajánlatot.',
}

export default async function VelencePage() {
  const [listing, gallery] = await Promise.all([getVelenceListing(), getVelenceGallery()])

  return (
    <main>
      {/* ---------------- HERO ---------------- */}
      <section className="relative min-h-[92vh] overflow-hidden text-cream">
        {gallery.hero ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gallery.hero} alt="Garden Vendégház Velence" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(24,36,31,0.55) 0%, rgba(24,36,31,0.35) 40%, rgba(22,51,43,0.85) 100%)' }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 75% 10%, var(--color-water) 0%, var(--color-pine) 45%, var(--color-pine-700) 100%)' }}>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full opacity-25" aria-hidden="true">
              <path d="M0 180 Q 150 120 300 180 T 600 180 T 900 180 T 1200 180 V300 H0 Z" fill="var(--color-sand)" opacity="0.18" />
              <path d="M0 220 Q 150 160 300 220 T 600 220 T 900 220 T 1200 220 V300 H0 Z" fill="var(--color-sand)" opacity="0.12" />
            </svg>
          </div>
        )}

        <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 md:px-8">
          <div className="hero-stagger max-w-2xl">
            <p className="label-caps !text-gold">Velencei-tó · déli part</p>
            <h1 className="mt-3 text-5xl leading-[0.98] md:text-7xl">Garden Vendégház</h1>
            <p className="mt-5 max-w-xl text-lg text-cream/90 md:text-xl">
              Az egész ház a tiétek a tóparti pihenéshez. Egyben bérelhető nyaraló <strong className="font-semibold">max 10+2 főnek</strong>, saját wellness sarokkal — baráti társaságnak, nagy családnak, közös hétvégékre.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#foglalas" className="btn btn-primary">Foglalás & ajánlat</a>
              <a href="tel:+36204971994" className="btn btn-ghost !border-cream/40 !text-cream hover:!bg-cream/10">+36 20 497 1994</a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/85">
              {['10+2 fő', '4 hálószoba', 'jakuzzi & szauna', 'min. 2 éj'].map((s) => (
                <li key={s} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gold" />{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="absolute right-5 top-24 md:right-10 md:top-28"><WaxSeal /></div>
      </section>

      {/* ---------------- INTRO ---------------- */}
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center md:px-8 md:py-28">
          <Reveal>
            <p className="label-caps">Nálatok a kulcs — és csak nálatok</p>
            <h2 className="mt-4 text-3xl md:text-4xl">Egy ház. Egy társaság. Semmi idegen.</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink/80">
              A Garden Vendégház kizárólag egyben bérelhető: a négy hálószoba, a közös terek és a wellness sarok mind a tiétek. A Velencei-tó déli partján, csendes környezetben — kényelmes alapja a hétvégi kiruccanásnak vagy a hosszabb nyaralásnak.
            </p>
          </Reveal>
        </div>
        <RippleDivider tone="reed" className="mx-auto max-w-5xl" />
      </section>

      {/* ---------------- SPACES ---------------- */}
      <section className="bg-sand">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal><p className="label-caps">A terek</p><h2 className="mt-3 text-3xl md:text-4xl">Két szint, tíz embernek kényelmesen</h2></Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal delay={60}>
              <SpaceCard
                tag="Emelet"
                title="4 hálószoba, erkéllyel"
                items={['4 különálló hálószoba', 'Erkély a reggeli kávéhoz', 'Fürdőszoba + külön WC']}
              />
            </Reveal>
            <Reveal delay={140}>
              <SpaceCard
                tag="Földszint"
                title="Nappali, konyha, fedett terasz"
                items={[
                  'Nappali-étkező kihúzható kanapéval (pótalvás)',
                  'Teljesen felszerelt konyha',
                  'Zuhanyzó + külön WC',
                  'Fedett terasz wellness sarokkal',
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- WELLNESS (signature block) ---------------- */}
      <section className="relative overflow-hidden bg-pine text-cream">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal><p className="label-caps !text-gold">Wellness</p><h2 className="mt-3 text-3xl md:text-5xl">A pihenés a fedett teraszon kezdődik</h2></Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { k: '6 fős', t: 'Jakuzsi', d: 'Pezsgőfürdő a társaságnak, a fedett teraszon.' },
              { k: '2 fős', t: 'Szauna', d: 'Meghitt finn szauna a feltöltődéshez.' },
              { k: 'Fedett', t: 'Terasz', d: 'Wellness sarok, időjárástól függetlenül.' },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 90}>
                <div className="h-full rounded-[var(--radius-xl)] border border-cream/15 bg-cream/5 p-7">
                  <div className="font-display text-4xl text-gold">{c.k}</div>
                  <h3 className="mt-2 text-2xl text-cream">{c.t}</h3>
                  <p className="mt-2 text-cream/80">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <RippleDivider tone="reed" className="opacity-30" />
      </section>

      {/* ---------------- GARDEN & PRACTICAL ---------------- */}
      <section className="bg-sand-2">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal><p className="label-caps">Kert & praktikum</p><h2 className="mt-3 text-3xl md:text-4xl">Szabadtér, sütögetés, kényelem</h2></Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Grill & bogrács', d: 'Közös főzéshez a kertben.' },
              { t: 'Ingyenes parkolás', d: '3 autó számára, a háznál.' },
              { t: 'Állatbarát', d: 'Kistestű kutya hozható, felár ellenében.' },
              { t: 'Tóparti környezet', d: 'A Velencei-tó déli partja, csendben.' },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 70}>
                <div className="h-full rounded-[var(--radius-lg)] border border-line bg-cream p-6">
                  <h3 className="text-xl">{c.t}</h3>
                  <p className="mt-2 text-sm text-ink/75">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- GALLERY (only when real photos exist) ---------------- */}
      {gallery.items.length > 0 && (
        <section className="bg-cream">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal><p className="label-caps">Galéria</p><h2 className="mt-3 text-3xl md:text-4xl">Nézz körül a házban</h2></Reveal>
            <div className="mt-10"><Gallery items={gallery.items} /></div>
          </div>
        </section>
      )}

      {/* ---------------- BOOKING ---------------- */}
      <section id="foglalas" className="scroll-mt-6 bg-sand">
        <div className="mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-28">
          <Reveal>
            <p className="label-caps">Foglalás</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Válassz dátumot — vagy kérj személyre szabott ajánlatot</h2>
            <p className="mt-4 max-w-2xl text-ink/75">
              Az online foglalásnál tájékoztató árat mutatunk; a végleges ajánlatot e-mailben visszaigazoljuk. Nincs nyilvános fix ár — az ajánlatkérés bármikor elérhető.
            </p>
          </Reveal>
          <Reveal delay={100}><div className="mt-10"><BookingWidget listing={listing} /></div></Reveal>
        </div>
      </section>

      {/* ---------------- INFO ---------------- */}
      <section className="bg-cream">
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
          <Reveal><p className="label-caps">Tudnivalók</p><h2 className="mt-3 text-3xl">Jó, ha tudod</h2></Reveal>
          <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[
              ['Minimum éjszaka', 'Alap 2 éj. 1 éj felár ellenében foglalható.'],
              ['Rendezvény / búcsú', 'Eltérő árazás — kérj ajánlatot az alkalomra.'],
              ['Árazás', 'Egyedi ajánlat alapján; a rendszerben látott összeg tájékoztató.'],
              ['NTAK azonosító', 'MA22041986'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-display text-lg text-pine">{t}</dt>
                <dd className="mt-1 text-ink/75">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- CONTACT / FOOTER ---------------- */}
      <footer className="bg-pine text-cream">
        <RippleDivider tone="reed" className="opacity-30" />
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl md:text-4xl">Garden Vendégház Velence</h2>
              <p className="mt-3 max-w-md text-cream/80">Egyben bérelhető nyaraló a Velencei-tó déli partján. Írj vagy hívj — munkanapokon 8–18 óra között válaszolunk.</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <a href="mailto:gardenvendeghazvelence@gmail.com" className="text-lg underline-offset-4 hover:underline">gardenvendeghazvelence@gmail.com</a>
              <a href="tel:+36204971994" className="text-lg underline-offset-4 hover:underline">+36 20 497 1994</a>
              <span className="text-sm text-cream/60">Elérhetőség: 8–18 óra</span>
              <a href="#foglalas" className="btn btn-primary mt-2">Foglalás & ajánlat</a>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-cream/15 pt-6 text-sm text-cream/60">
            <span>NTAK: MA22041986</span>
            <span>© {new Date().getFullYear()} Garden Vendégház</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

function SpaceCard({ tag, title, items }: { tag: string; title: string; items: string[] }) {
  return (
    <div className="card h-full p-7 md:p-8">
      <span className="label-caps">{tag}</span>
      <h3 className="mt-2 text-2xl">{title}</h3>
      <ul className="mt-5 space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-ink/80">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
