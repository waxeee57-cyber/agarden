'use client'

import { useState } from 'react'

// The organiser's real job: get the group to say yes. One tap shares the
// house's facts (and the chosen dates) to the group chat: native share sheet
// where available, otherwise copy-to-clipboard plus a WhatsApp link.
export function ShareButton({
  title,
  lines,
  origin,
  checkIn,
  checkOut,
  variant = 'line',
  label = 'Küldd el a társaságnak',
}: {
  title: string
  lines: string[]
  origin: string
  checkIn?: string | null
  checkOut?: string | null
  variant?: 'line' | 'act'
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const url = checkIn && checkOut ? `${origin}/?checkIn=${checkIn}&checkOut=${checkOut}#foglalas` : `${origin}/`
  const dates = checkIn && checkOut ? [`Dátum: ${checkIn.replaceAll('-', '. ')}. – ${checkOut.replaceAll('-', '. ')}.`] : []
  const text = [title, ...lines, ...dates].join('\n')

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener')
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" onClick={share} className={`btn ${variant === 'act' ? 'btn-act' : 'btn-line'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" />
        </svg>
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-soft">{copied ? 'Kimásolva: illeszd be a csoportba.' : ''}</span>
    </span>
  )
}
