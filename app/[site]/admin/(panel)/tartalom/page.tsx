import { redirect } from 'next/navigation'

// "Tartalom" became "Szövegek" (2026-10-30); old bookmarks keep working.
export default function Page() {
  redirect('/admin/szovegek?doc=bemutatkozas')
}
