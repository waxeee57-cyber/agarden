'use client'

import { useParams } from 'next/navigation'
import { BRANDS, telHref } from '@/lib/brand'
import { isSite } from '@/lib/sites'

// When the DB is unreachable the page must still give a way to book: phone + e-mail.
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ site: string }>()
  const b = BRANDS[isSite(params.site) ? params.site : 'velence']
  return (
    <main data-skin={isSite(params.site) ? params.site : 'velence'} className="skin-root"><div className="mx-auto flex min-h-[70svh] max-w-xl flex-col justify-center px-4 py-16">
      <p className="kicker">{b.fullName}</p>
      <h1 className="mt-3 text-4xl">Az oldal most nem tölt be teljesen.</h1>
      <p className="mt-4 text-fg/85">Foglaláshoz és kérdésekhez hívj minket, vagy próbáld újra pár perc múlva.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <a className="btn btn-act" href={telHref(b.phone)}>{b.phone}</a>
        {b.email && <a className="btn btn-line" href={`mailto:${b.email}`}>{b.email}</a>}
        <button type="button" className="btn btn-line" onClick={reset}>Újrapróbálom</button>
      </div>
    </div></main>
  )
}
