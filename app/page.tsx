import { redirect } from 'next/navigation'

// The portfolio landing page is slice 4. For now the only showcase is /velence.
export default function Home() {
  redirect('/velence')
}
