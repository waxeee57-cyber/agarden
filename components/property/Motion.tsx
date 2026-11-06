'use client'

import { useEffect, useRef, useState } from 'react'

// Motion layer, modelled on the reference (velenceviolavilla.hu, Divi):
//  - StickyHeader: fixed bar 84 → 60 px with a soft shadow once the page
//    scrolls (Divi et-fixed-header). The outer box keeps its height, so the
//    page never jumps (CLS 0); only the inner bar shrinks.
//  - RevealObserver: sections fade up once as they enter the viewport
//    ([data-reveal], stagger via --i). Above-the-fold elements are marked
//    visible before the effect switches on, so nothing flashes.
//  - Parallax: the reference's slow background drift (translateY ≈ 0.2 ×
//    scroll), transform-only, rAF-throttled, only while on screen.
// Everything is off with prefers-reduced-motion.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let raf = 0
    const read = () => { raf = 0; setScrolled(window.scrollY > 24) }
    const on = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return (
    <header className="site-header pointer-events-none sticky top-0 z-40 h-[76px] md:h-[84px]" data-scrolled={scrolled || undefined}>
      <div className="site-bar pointer-events-auto relative border-b border-black/[0.08]">{children}</div>
    </header>
  )
}

export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length) return
    if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return }
    // No layout reads here (getBoundingClientRect on every element forced a
    // full layout, deferred content-visibility sections included). The FIRST
    // observer batch says what is on screen: those stay as rendered, and only
    // then does reveal-on hide the rest — off screen, so nothing flashes.
    let first = true
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && (first || en.intersectionRatio >= 0.08)) { en.target.classList.add('is-in'); io.unobserve(en.target) }
      }
      if (first) { first = false; root.classList.add('reveal-on') }
    }, { threshold: [0, 0.08] })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return null
}

export function Parallax({ children, speed = 0.18, className = '' }: { children: React.ReactNode; speed?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current, ly = layer.current
    if (!el || !ly || reduced()) return
    let raf = 0, visible = false
    const paint = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const off = (r.top + r.height / 2 - window.innerHeight / 2) * -speed
      ly.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`
    }
    const on = () => { if (visible && !raf) raf = requestAnimationFrame(paint) }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) on() }, { rootMargin: '120px 0px' })
    io.observe(el)
    // first position comes from the observer callback (in a frame), never a
    // synchronous layout read at hydration
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { io.disconnect(); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf) }
  }, [speed])
  return (
    <div ref={box} aria-hidden="true" className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div ref={layer} className="absolute inset-x-0 -bottom-[14%] -top-[14%] will-change-transform">{children}</div>
    </div>
  )
}
