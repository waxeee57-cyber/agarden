import Image from 'next/image'
import { telHref } from '@/lib/brand'
import { Reveal } from '@/components/property/Reveal'
import { ShareButton } from '@/components/property/ShareButton'
import { Steam } from '@/components/property/Steam'
import { Booking, Faq, SisterTeaser, coverOf, type HomeData } from './shared'

// GARDEN — the night wellness house for a group.
// Scene: one organiser, evening, phone in hand, convincing ten friends in a
// group chat. So the page answers the group's questions in the order a
// weekend actually happens, and the share card hands the organiser the pitch.
// Structure = a real sequence (Friday → Saturday → Saturday night → Sunday).

export function GardenHome({ d }: { d: HomeData }) {
  const { listing } = d
  const c = listing.content
  const cover = coverOf(d.photos)
  const rest = d.photos.filter((p) => p.id !== cover?.id)
  const facade = rest.find((p) => /homlokzat|utca/i.test(p.alt)) ?? rest[0] ?? null
  const terrace = rest.find((p) => p.id !== facade?.id) ?? null
  const total = listing.capacityMax + listing.capacityExtra
  const share = {
    title: `${listing.name}: egész ház ${total} főre`,
    lines: ['6 fős jakuzzi és 2 fős szauna a fedett teraszon', 'Kert grillel és bográccsal, 4 hálószoba, parkolás 3 autónak', `Minimum ${listing.minNights} éjszaka, csak a mi társaságunk lenne ott`],
    origin: d.origin,
  }

  const sign = [`${listing.capacityMax}+${listing.capacityExtra} fő`, '4 hálószoba', '6 fős jakuzzi', '2 fős szauna', '3 autó ingyen', `min. ${listing.minNights} éj`]

  return (
    <>
      {/* ---------------- HERO: type left, the steaming night tub right ---------------- */}
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-28 md:px-8 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:pb-24 lg:pt-36">
          <div className="rise order-2 lg:order-1">
            <h1 id="hero-title">
              <span className="block font-sans text-sm font-semibold normal-case tracking-[0.14em] text-pop">Garden Vendégház · Velence</span>
              <span className="mt-4 block text-[clamp(3.4rem,9.5vw,8.6rem)] leading-[0.86]">
                Saját jakuzzi.<br />Saját szauna.<br /><span className="text-pop">{total} főnek.</span>
              </span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg text-fg/85 md:text-xl">{c.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#foglalas" className="btn btn-act">Szabad dátumok</a>
              <ShareButton {...share} />
            </div>
            <p className="mt-5 text-sm text-soft">
              Kérdésed van? <a href={telHref(d.phone)} className="font-semibold text-fg underline underline-offset-4">{d.phone}</a>
              {c.contact_hours ? `, ${c.contact_hours}` : ''}
            </p>
          </div>
          <div className="relative order-1 lg:order-2">
            {cover && (
              <div className="relative ml-auto aspect-[4/3] w-full sm:aspect-[4/5] max-w-[520px] overflow-hidden rounded-[4px] shadow-[0_0_120px_-20px_rgb(228_163_92/0.35)]">
                <Image src={cover.url} alt={cover.alt} fill preload sizes="(min-width: 1024px) 520px, 92vw" quality={70} className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent" aria-hidden="true" />
              </div>
            )}
            <Steam className="pointer-events-none absolute -top-10 right-10 h-28 w-36 text-fg/50 lg:-top-16" />
          </div>
        </div>
      </section>

      {/* ---------------- the house as a signboard ---------------- */}
      <div className="border-y border-rule">
        <ul className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 font-display text-[1.45rem] font-extrabold uppercase tracking-[0.03em] md:px-8 md:text-[1.8rem]" aria-label="A ház röviden">
          {sign.map((s, i) => (
            <li key={s} className="flex items-center gap-6">{i > 0 && <span aria-hidden="true" className="text-pop">·</span>}{s}</li>
          ))}
        </ul>
      </div>

      {/* ---------------- A WEEKEND, IN ORDER ---------------- */}
      <section id="hetvege" className="scroll-mt-4" aria-labelledby="hetvege-title">
        <div className="mx-auto max-w-7xl px-4 pt-20 md:px-8 md:pt-28">
          <h2 id="hetvege-title" className="max-w-4xl text-[clamp(2.6rem,6vw,5rem)]">Egy hétvége a Gardenben</h2>
          <p className="mt-4 max-w-[60ch] text-lg text-fg/80">{c.intro_body}</p>
        </div>

        <Chapter day="Péntek" title="Megérkeztek" photo={facade}>
          Három autó ingyen elfér a háznál. Fent négy hálószoba, erkély, fürdőszoba és külön WC.
          Lent nappali-étkező kihúzható kanapéval: ide alszik a tizenegyedik és a tizenkettedik.
        </Chapter>
        <Chapter day="Szombat" title="Kint vagytok" photo={terrace} flip>
          Kert grillel és bográccsal, fedett terasz a közös asztalnak. A földszinten konyha,
          zuhanyzó és külön WC, így senkinek nem kell az emeletre szaladnia.
        </Chapter>

        {/* Saturday night: the signature, drenched in lamplight */}
        <div className="relative mt-20 overflow-hidden bg-band text-band-fg md:mt-28">
          <Steam className="pointer-events-none absolute -bottom-6 right-[8%] h-64 w-80 text-band-fg/25" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-[auto_1fr] md:gap-16 md:px-8 md:py-28">
            <p className="font-display text-2xl font-extrabold uppercase tracking-[0.06em]">Szombat este</p>
            <div>
              <h3 className="text-[clamp(4rem,14vw,11rem)] leading-[0.82]">Gőz.</h3>
              <p className="mt-6 max-w-[38rem] text-xl font-medium md:text-2xl">
                A fedett terasz wellness sarkában 6 fős jakuzzi és 2 fős szauna. Csak a tiétek:
                a házat egyben adjuk ki, idegen nem jön be.
              </p>
            </div>
          </div>
        </div>

        <Chapter day="Vasárnap" title="Maradnátok még?">
          Legalább {listing.minNights} éjszakára foglalható. 1 éjszaka felár ellenében.
          A távozás napján már érkezhet a következő társaság, ezért a dátumokat a naptár pontosan mutatja.
        </Chapter>
      </section>

      {/* ---------------- EVENTS ---------------- */}
      <section className="border-t border-rule" aria-labelledby="buli-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <h2 id="buli-title" className="text-[clamp(2.6rem,6vw,5rem)]">Legénybúcsú, lánybúcsú, szülinap</h2>
          <div>
            <p className="text-lg text-fg/85">
              Búcsúra és rendezvényre is kiadjuk a házat, eltérő áron. Írd meg, hányan jöttök, mikor
              és mire készültök, és ajánlatot küldünk. Kistestű kutya felár ellenében jöhet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="?ajanlat=1&rendezveny=1#foglalas" className="btn btn-act">Rendezvény-ajánlatot kérek</a>
              <ShareButton {...share} label="Megmutatom a többieknek" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- BOOKING ---------------- */}
      <section id="foglalas" className="scroll-mt-4 bg-band-2" aria-labelledby="foglalas-title">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="foglalas-title" className="text-[clamp(2.6rem,6vw,5rem)]">Szabad dátumok</h2>
            <p className="max-w-md text-fg/80">
              Válassz napokat, és a ház a visszaigazolásig a tiétek. Most nem vonunk le pénzt: visszaigazolás e-mailben, fizetés a helyszínen.
            </p>
          </div>
          <div className="mt-10"><Booking d={d} share={share} /></div>
        </div>
      </section>

      {/* ---------------- RULES & FACTS ---------------- */}
      <section id="tudnivalok" className="scroll-mt-4" aria-labelledby="tudnivalok-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-[1fr_1.6fr] md:px-8 md:py-28">
          <h2 id="tudnivalok-title" className="text-4xl md:text-6xl">Mielőtt foglaltok</h2>
          <dl className="grid gap-x-10 border-t border-rule sm:grid-cols-2">
            {[
              ['Létszám', `legfeljebb ${listing.capacityMax}+${listing.capacityExtra} fő, csak egyben bérelhető`],
              ['Minimum', `${listing.minNights} éjszaka, 1 éjszaka felárral`],
              ['Ár', listing.pricingMode === 'fixed' ? 'A foglalóban tájékoztató végösszeget látsz.' : 'Egyedi ajánlat, a visszaigazolással együtt küldjük.'],
              ['Fizetés', 'Online nem vonunk le pénzt; fizetés a helyszínen.'],
              ...listing.houseRules.filter((r) => !/egyben|minimum/i.test(r.t)).map((r) => [r.t, r.d] as [string, string]),
              ...(listing.ntakId ? [['NTAK', listing.ntakId] as [string, string]] : []),
            ].map(([t, v]) => (
              <div key={t} className="border-b border-rule py-5">
                <dt className="font-display text-xl font-extrabold uppercase tracking-[0.04em] text-pop">{t}</dt>
                <dd className="mt-1 text-fg/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="border-t border-rule"><Faq items={c.faq ?? []} title="Kérdések a csoportchatből" /></div>
      <SisterTeaser d={d} />
    </>
  )
}

function Chapter({ day, title, photo, flip = false, children }: { day: string; title: string; photo?: HomeData['photos'][number] | null; flip?: boolean; children: React.ReactNode }) {
  return (
    <Reveal>
      <article className="mx-auto mt-20 grid max-w-7xl gap-8 px-4 md:mt-28 md:grid-cols-12 md:gap-10 md:px-8">
        <p className="font-display text-2xl font-extrabold uppercase tracking-[0.06em] text-pop md:col-span-2">{day}</p>
        <div className={`md:col-span-5 ${flip && photo ? 'md:order-3' : ''}`}>
          <h3 className="text-[clamp(2.2rem,4.6vw,3.8rem)]">{title}</h3>
          <p className="mt-5 max-w-[46ch] text-lg text-fg/85">{children}</p>
        </div>
        {photo && (
          <div className={`relative aspect-[4/3] overflow-hidden rounded-[4px] md:col-span-5 ${flip ? 'md:order-2' : ''}`}>
            <Image src={photo.url} alt={photo.alt} fill sizes="(min-width: 768px) 40vw, 92vw" className="object-cover" />
          </div>
        )}
      </article>
    </Reveal>
  )
}
