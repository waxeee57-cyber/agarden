import Link from 'next/link'
import { telHref } from '@/lib/brand'
import { Icon } from './ui'

// Phone-width sticky bar: the two actions a guest takes — book, or call.
// Not rendered on /foglalas (the wizard has its own call button).
export function MobileStickyCTA({ phone }: { phone: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-bg/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex gap-3 px-4 py-3">
        <Link href="/foglalas" className="btn btn-act flex-1">Foglalás</Link>
        <a href={telHref(phone)} className="btn btn-line flex-1"><Icon name="phone" /> Hívás</a>
      </div>
    </div>
  )
}
