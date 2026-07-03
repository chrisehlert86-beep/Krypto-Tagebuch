'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

type Invite = {
  id: string
  invite_code: string
  active: boolean
  used: boolean
  created_at: string
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  async function loadInvites() {
    try {
      const response = await fetch('/api/admin/invites')

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? 'Einladungscodes konnten nicht geladen werden.')
        return
      }

      setInvites(data)
    } catch (error) {
      console.error(error)
      toast.error('Serverfehler beim Laden der Einladungscodes.')
    } finally {
      setLoading(false)
    }
  }

  async function generate(amount: number) {
    setGenerating(true)

    try {
      const response = await fetch('/api/admin/invites/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error ?? 'Einladungscodes konnten nicht erstellt werden.')
        return
      }

      toast.success(`${amount} Einladungscode${amount > 1 ? 's' : ''} erstellt.`)

      await loadInvites()

    } catch (error) {
      console.error(error)
      toast.error('Serverfehler beim Erstellen der Einladungscodes.')
    } finally {
      setGenerating(false)
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)

      toast.success('Einladungscode wurde kopiert.')

    } catch (error) {
      console.error(error)

      toast.error('Einladungscode konnte nicht kopiert werden.')
    }
  }

  useEffect(() => {
    loadInvites()
  }, [])

  return (
    <>
      <PageHeader
        title="Einladungscodes"
        subtitle="Verwalte und generiere Einladungscodes."
      />

      <Card>

        <div className="mb-8 flex flex-wrap gap-3">

          <Button color="blue" onClick={() => generate(1)}>
            +1 Code
          </Button>

          <Button color="blue" onClick={() => generate(5)}>
            +5 Codes
          </Button>

          <Button color="blue" onClick={() => generate(10)}>
            +10 Codes
          </Button>

          <Button color="blue" onClick={() => generate(50)}>
            +50 Codes
          </Button>

        </div>

        {loading || generating ? (

          <p className="py-10 text-center text-xl font-semibold text-black">
            Einladungscodes werden geladen...
          </p>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full border border-gray-300">

              <thead className="bg-gray-200">

                <tr>

                  <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                    Einladungscode
                  </th>

                  <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                    Aktiv
                  </th>

                  <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                    Verwendet
                  </th>

                  <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                    Erstellt
                  </th>

                </tr>

              </thead>

              <tbody>

                {invites.map((invite) => (

                  <tr
                    key={invite.id}
                    onClick={() => copy(invite.invite_code)}
                    className="cursor-pointer border-b border-gray-300 transition hover:bg-blue-50"
                  >

                    <td className="px-6 py-4 font-mono font-bold text-black">
                      {invite.invite_code}
                    </td>

                    <td className="px-6 py-4 font-medium text-black">
                      {invite.active ? '🟢 Ja' : '🔴 Nein'}
                    </td>

                    <td className="px-6 py-4 font-medium text-black">
                      {invite.used ? '✅ Ja' : '❌ Nein'}
                    </td>

                    <td className="px-6 py-4 text-black">
                      {new Date(invite.created_at).toLocaleString('de-DE')}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </Card>

    </>
  )
}