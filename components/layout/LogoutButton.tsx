'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LogoutButton() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)

    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' })

      if (!response.ok) {
        throw new Error('Abmeldung fehlgeschlagen.')
      }

      router.replace('/admin/login')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Abmeldung fehlgeschlagen.')
      setLoggingOut(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loggingOut}
      className="rounded-lg bg-red-700 px-5 py-2 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loggingOut ? 'Abmeldung...' : 'Abmelden'}
    </button>
  )
}
