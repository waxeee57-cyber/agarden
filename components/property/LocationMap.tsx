'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

// Leaflet touches `window` at import time → client-only, never SSR. The chunk
// is only requested once the map scrolls near the viewport, so it never weighs
// on the first paint.
const MapInner = dynamic(() => import('./LocationMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" aria-hidden="true" />,
})

export function LocationMap(props: { lat: number; lng: number; label: string; color: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return <div ref={ref} className="h-full w-full">{near ? <MapInner {...props} /> : <div className="h-full w-full bg-surface-2" aria-hidden="true" />}</div>
}
