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
        toast.error(
          data.error ??
            'Einladungscodes konnten nicht geladen werden.'
        )
        return
      }

      setInvites(data)

    } catch (error) {

      console.error(error)

      toast.error(
        'Serverfehler beim Laden der Einladungscodes.'
      )

    } finally {

      setLoading(false)

    }
  }

  async function generate(amount: number) {
    setGenerating(true)

    try {

      const response = await fetch(
        '/api/admin/invites/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        toast.error(
          result.error ??
            'Einladungscodes konnten nicht erstellt werden.'
        )
        return
      }

      toast.success(
        `${amount} Einladungscode${amount > 1 ? 's' : ''} erstellt.`
      )

      await loadInvites()

    } catch (error) {

      console.error(error)

      toast.error(
        'Serverfehler beim Erstellen der Einladungscodes.'
      )

    } finally {

      setGenerating(false)

    }
  }

  async function toggle(id: string) {
    try {

      const response = await fetch(
        '/api/admin/invites/toggle',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Einladung aktualisiert.')

      await loadInvites()

    } catch (error) {

      console.error(error)

      toast.error('Serverfehler.')

    }
  }

  async function remove(id: string) {

    if (
      !confirm(
        'Einladungscode wirklich löschen?'
      )
    ) {
      return
    }

    try {

      const response = await fetch(
        '/api/admin/invites/delete',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error)
        return
      }

      toast.success(
        'Einladung gelöscht.'
      )

      await loadInvites()

    } catch (error) {

      console.error(error)

      toast.error('Serverfehler.')

    }
  }

  async function copy(code: string) {
    try {

      await navigator.clipboard.writeText(code)

      toast.success(
        'Einladungscode kopiert.'
      )

    } catch {

      toast.error(
        'Kopieren fehlgeschlagen.'
      )

    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInvites(), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <>
      <PageHeader
        title="Einladungscodes"
        subtitle="Verwalte und generiere Einladungscodes."
      />

      <Card>

        <div className="mb-8 flex flex-wrap gap-3">

          <Button
            color="blue"
            onClick={() => generate(1)}
          >
            +1 Code
          </Button>

          <Button
            color="blue"
            onClick={() => generate(5)}
          >
            +5 Codes
          </Button>

          <Button
            color="blue"
            onClick={() => generate(10)}
          >
            +10 Codes
          </Button>

          <Button
            color="blue"
            onClick={() => generate(50)}
          >
            +50 Codes
          </Button>

        </div>

        {loading || generating ? (

          <p className="py-10 text-center text-xl font-semibold text-black">
            Einladungscodes werden geladen...
          </p>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full border border-gray-300 text-black">

              <thead className="bg-gray-200">

                <tr>

                  <th className="px-6 py-4 text-left">
                    Einladungscode
                  </th>

                  <th className="px-6 py-4 text-left">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left">
                    Erstellt
                  </th>

                  <th className="px-6 py-4 text-center">
                    Aktionen
                  </th>

                </tr>

              </thead>

              <tbody>

                {invites.map((invite) => (

                  <tr
                    key={invite.id}
                    className="border-b hover:bg-blue-50"
                  >

                    <td
                      className="cursor-pointer px-6 py-4 font-mono font-bold"
                      onClick={() =>
                        copy(invite.invite_code)
                      }
                    >
                      {invite.invite_code}
                    </td>

                    <td className="px-6 py-4">

                      {invite.used ? (
                        <span className="font-semibold text-gray-600">
                          🔒 Verwendet
                        </span>
                      ) : invite.active ? (
                        <span className="font-semibold text-green-700">
                          🟢 Aktiv
                        </span>
                      ) : (
                        <span className="font-semibold text-red-700">
                          ⚫ Deaktiviert
                        </span>
                      )}

                    </td>

                    <td className="px-6 py-4">
                      {new Date(
                        invite.created_at
                      ).toLocaleString('de-DE')}
                    </td>

                    <td className="px-6 py-4">

                      {!invite.used && (

                        <div className="flex justify-center gap-2">

                          <Button
                            color={
                              invite.active
                                ? 'yellow'
                                : 'green'
                            }
                            onClick={() =>
                              toggle(invite.id)
                            }
                          >
                            {invite.active
                              ? 'Deaktivieren'
                              : 'Aktivieren'}
                          </Button>

                          <Button
                            color="red"
                            onClick={() =>
                              remove(invite.id)
                            }
                          >
                            Löschen
                          </Button>

                        </div>

                      )}

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
