'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)

  const [loginRequestId, setLoginRequestId] = useState<string | null>(null)

  const [error, setError] = useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setError('')

    try {

      const response = await fetch(
        '/api/admin/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        setError(
          result.error ??
            'Login fehlgeschlagen.'
        )
        return
      }

      setLoginRequestId(result.loginRequestId)
      setWaiting(true)

    } catch (err) {

      console.error(err)

      setError('Serverfehler.')

    } finally {

      setLoading(false)

    }
  }

  useEffect(() => {

    if (!waiting || !loginRequestId) {
      return
    }

    const interval = setInterval(async () => {

      try {

        const response = await fetch(
          '/api/admin/login/status',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              loginRequestId,
            }),
          }
        )

        const result = await response.json()

        if (result.expired) {

          clearInterval(interval)

          setWaiting(false)

          setError(
            'Die Anmeldung ist abgelaufen.'
          )

          return

        }

        if (result.rejected) {

          clearInterval(interval)

          setWaiting(false)

          setError(
            'Die Anmeldung wurde abgelehnt.'
          )

          return

        }

        if (!result.approved) {
          return
        }

        clearInterval(interval)

        const session = await fetch(
          '/api/admin/session',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              loginRequestId,
            }),
          }
        )

        if (!session.ok) {

          setWaiting(false)

          setError(
            'Session konnte nicht erstellt werden.'
          )

          return

        }

        router.replace('/admin')

      } catch (err) {

        console.error(err)

      }

    }, 2000)

    return () => clearInterval(interval)

  }, [waiting, loginRequestId, router])

  if (waiting) {
    return (

      <div className="flex min-h-screen items-center justify-center bg-slate-100">

        <div className="w-full max-w-md rounded-xl bg-white p-10 text-black">

          <div className="space-y-6 text-center">

            <div className="text-6xl">
              📲
            </div>

            <h2 className="text-2xl font-bold">
              Anmeldung bestätigen
            </h2>

            <p className="py-10 text-center text-lg text-black">
              Bitte bestätige die Anmeldung
              über Telegram.
            </p>

            <div className="flex justify-center">

              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

            </div>

            <p className="text-sm text-gray-500">
              Es wird automatisch weitergeleitet,
              sobald die Anmeldung genehmigt wurde.
            </p>

          </div>

        </div>

      </div>

    )
  }

  return (

    <div className="flex min-h-screen items-center justify-center bg-slate-100">

      <div className="w-full max-w-md rounded-xl bg-white p-10 shadow-lg">

        <h1 className="mb-8 text-center text-3xl font-bold">
          Admin Login
        </h1>

        <form
          onSubmit={login}
          className="space-y-6"
        >

          <div>

            <label className="mb-2 block font-semibold">
              Benutzername
            </label>

            <input
              type="text"
              className="w-full rounded-lg border p-3"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />

          </div>

          <div>

            <label className="mb-2 block font-semibold">
              Passwort
            </label>

            <input
              type="password"
              className="w-full rounded-lg border p-3"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

          </div>

          {error && (

            <p className="font-semibold text-red-600">
              {error}
            </p>

          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Anmeldung...'
              : 'Anmelden'}
          </button>

        </form>

      </div>

    </div>

  )
}