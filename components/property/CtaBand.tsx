import Link from 'next/link'
import type { SiteCtx } from '@/lib/page'
import { telHref } from '@/lib/brand'
import { CASH_LINE } from '@/lib/terms'

// Closing call to action before the footer — the reference ends its rooms
// page with a full-width colour band ("Foglaljon még ma…"). Ours is the
// house accent, says what happens next (request, confirmation, cash on site)
// and offers the phone as the second way in. Only stored facts.
export function CtaBand({ ctx }: { ctx: SiteCtx }) {
  const l = ctx.listing
  const hours = l.terms.confirmHours
  return (
    <section aria-labelledby="cta-t" className="bg-deep text-deep-fg">
      <div className="mx-auto max-w-4xl px-5 py-16 text-center md:px-8 md:py-24">
        {l.capacityMax > 0 && <p className="kicker text-deep-fg/80">Egyben bérelhető · {l.capacityMax}{l.capacityExtra ? `+${l.capacityExtra}` : ''} fő</p>}
        <h2 id="cta-t" className="mt-4 text-[clamp(1.9rem,4.2vw,3rem)] text-deep-fg">Foglaljon most, a napokat azonnal fenntartjuk</h2>
        <p className="mx-auto mt-5 max-w-[54ch] text-deep-fg/85">
          {hours ? `${hours} órán belül e-mailben visszaigazoljuk. ` : 'E-mailben visszaigazoljuk. '}{CASH_LINE}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/foglalas" className="btn btn-white">Foglalás</Link>
          <a href={telHref(ctx.phone)} className="btn btn-light">Hívás: {ctx.phone}</a>
        </div>
      </div>
    </section>
  )
}
