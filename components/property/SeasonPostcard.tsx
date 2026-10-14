'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Stamp } from './ui'

export type Season = 'nyar' | 'tel'
type Shot = { url: string; width: number; height: number; alt: string }

// Napsugár's signature: the hero is a holiday postcard, and the season switch
// re-shoots it. Summer = the pool under the tree; winter = the evening yard
// with the all-year jacuzzi. The facts under it change with the season.
export function SeasonPostcard({ initial, summer, winter, facts }: {
  initial: Season
  summer: Shot | null
  winter: Shot | null
  facts: Record<Season, string[]>
}) {
  const [season, setSeason] = useState<Season>(winter ? initial : 'nyar')
  const shot = season === 'tel' && winter ? winter : summer ?? winter

  return (
    <figure className="relative mx-auto w-full max-w-[560px]">
      <div className="relative rotate-[-1.6deg] bg-[#FFFDF8] p-3 pb-12 shadow-[0_30px_60px_-30px_rgb(28_41_48/0.55)] sm:p-4 sm:pb-14">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
          {summer && (
            <Image src={summer.url} alt={summer.alt} fill preload={initial === 'nyar' || !winter} sizes="(min-width: 1024px) 560px, 92vw" quality={70}
              className={`object-cover transition-opacity duration-500 ${shot === summer ? 'opacity-100' : 'opacity-0'}`} />
          )}
          {winter && (
            <Image src={winter.url} alt={winter.alt} fill preload={initial === 'tel'} sizes="(min-width: 1024px) 560px, 92vw" quality={70}
              className={`object-cover transition-opacity duration-500 ${shot === winter ? 'opacity-100' : 'opacity-0'}`} />
          )}
        </div>
        <figcaption className="absolute inset-x-4 bottom-3 font-display text-[1.35rem] text-[#1C2930] sm:bottom-4 sm:text-[1.6rem]">
          Üdvözlet a Napsugárból!
        </figcaption>
        <span className="absolute -right-3 -top-9 rotate-[7deg] sm:-right-8 sm:-top-12"><Stamp caption={season === 'nyar' ? 'Nyár · 25–28 °C' : 'Tél · 20–40 °C'} /></span>
      </div>

      {winter && summer && (
        <div className="mt-8 flex items-center gap-2" role="group" aria-label="Évszak">
          {(['nyar', 'tel'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={season === s}
              onClick={() => setSeason(s)}
              className={`min-h-12 rounded-full border-2 px-5 text-sm font-bold transition-colors ${season === s ? 'border-fg bg-fg text-bg' : 'border-fg/30 text-fg hover:border-fg'}`}
            >
              {s === 'nyar' ? 'Nyáron' : 'Télen'}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-4 space-y-1.5 text-[0.98rem]" aria-live="polite">
        {facts[season].map((f) => (
          <li key={f} className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.55em] h-2 w-2 shrink-0 rounded-full bg-act" />{f}</li>
        ))}
      </ul>
    </figure>
  )
}
