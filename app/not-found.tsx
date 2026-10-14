import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-xl flex-col justify-center px-4 py-16">
      <p className="label-caps">404</p>
      <h1 className="mt-3 text-4xl">Ez az oldal nem található.</h1>
      <p className="mt-4 text-ink/80">Lehet, hogy elírás történt, vagy az oldal már nem létezik.</p>
      <Link href="/" className="btn btn-primary mt-7 self-start">Vissza a kezdőlapra</Link>
    </main>
  )
}
