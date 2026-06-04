'use client'

import { useEffect, useRef, useState } from 'react'

// Staggered scroll reveal via IntersectionObserver. `delay` (ms) cascades a row
// of items. Respects prefers-reduced-motion (the CSS .reveal rules are gated).
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article'
  className?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
