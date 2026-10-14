'use client'

import { useState } from 'react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        window.location.href = '/admin'
        return
      }
      setError(res.status === 429 ? 'Túl sok próbálkozás. Várj 15 percet.' : 'Hibás e-mail cím vagy jelszó.')
    } catch {
      setError('Nem sikerült kapcsolódni. Próbáld újra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="password">Jelszó</label>
        <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn btn-dark w-full" disabled={busy}>{busy ? 'Belépés…' : 'Belépés'}</button>
    </form>
  )
}
