// Garden's motion signature: three wisps of steam, CSS-animated (globals.css
// .steam), static under prefers-reduced-motion. Decorative only.
export function Steam({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={`steam ${className}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M32 86 c-10 -12 10 -20 0 -32 c-10 -12 10 -20 0 -32" />
      <path d="M60 86 c-10 -12 10 -20 0 -32 c-10 -12 10 -20 0 -32" />
      <path d="M88 86 c-10 -12 10 -20 0 -32 c-10 -12 10 -20 0 -32" />
    </svg>
  )
}
