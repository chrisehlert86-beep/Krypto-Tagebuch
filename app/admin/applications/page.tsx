'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

type Application = {
  id: string
  first_name: string
  last_name: string
  invite_code: string
  status: string
  created_at: string
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  async function loadApplications() {
    try {
      const response = await fetch('/api/admin/applications')

      const data = await response.json()

      if (!response.ok) {
        toast.error(
          data.error ??
            'Bewerbungen konnten nicht geladen werden.'
        )
        return
      }

      setApplications(data)

    } catch (error) {

      console.error(error)

      toast.error(
        'Serverfehler beim Laden der Bewerbungen.'
      )

    } finally {

      setLoading(false)

    }
  }

  async function approveApplication(id: string) {
    try {

      const response = await fetch(
        '/api/admin/applications/approve',
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
        toast.error(
          result.error ??
            'Bewerbung konnte nicht freigegeben werden.'
        )
        return
      }

      toast.success(
        'Bewerbung wurde freigegeben.'
      )

      await loadApplications()

    } catch (error) {

      console.error(error)

      toast.error(
        'Serverfehler beim Freigeben.'
      )

    }
  }

  async function rejectApplication(id: string) {
    if (!confirm('Bewerbung wirklich ablehnen?')) return

    try {
      const response = await fetch('/api/admin/applications/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error ?? 'Bewerbung konnte nicht abgelehnt werden.')
        return
      }

      toast.success('Bewerbung wurde abgelehnt.')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Serverfehler beim Ablehnen.')
    }
  }

  async function deleteApplication(id: string) {
    if (!confirm('Bewerbung wirklich endgültig löschen?')) return

    try {
      const response = await fetch('/api/admin/applications/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error ?? 'Bewerbung konnte nicht gelöscht werden.')
        return
      }

      toast.success('Bewerbung wurde gelöscht.')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Serverfehler beim Löschen.')
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadApplications(), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  if (loading) {
    return (
      <>
        <PageHeader
          title="Bewerbungen"
          subtitle="Alle eingegangenen Bewerbungen"
        />

        <Card>

          <p className="py-8 text-center text-xl font-semibold text-black">
            Bewerbungen werden geladen...
          </p>

        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Bewerbungen"
        subtitle="Verwalte eingegangene Bewerbungen."
      />

      <Card>

        <div className="overflow-x-auto">

          <table className="min-w-full border border-gray-300">

            <thead className="bg-gray-200">

              <tr>

                <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                  Name
                </th>

                <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                  Einladungscode
                </th>

                <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                  Status
                </th>

                <th className="border-b border-gray-300 px-6 py-4 text-left font-bold text-black">
                  Datum
                </th>

                <th className="border-b border-gray-300 px-6 py-4 text-center font-bold text-black">
                  Aktionen
                </th>

              </tr>

            </thead>

            <tbody>

              {applications.length === 0 ? (

                <tr>

                  <td
                    colSpan={5}
                    className="py-10 text-center text-lg font-medium text-black"
                  >
                    Keine Bewerbungen vorhanden.
                  </td>

                </tr>

              ) : (

                applications.map((application) => (

                  <tr
                    key={application.id}
                    className="border-b border-gray-300 transition hover:bg-blue-50"
                  >

                    <td className="px-6 py-4 font-semibold text-black">
                      {application.first_name} {application.last_name}
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-black">
                      {application.invite_code}
                    </td>

                    <td className="px-6 py-4">
                      <Badge status={application.status} />
                    </td>

                    <td className="px-6 py-4 text-black">
                      {new Date(
                        application.created_at
                      ).toLocaleString('de-DE')}
                    </td>

                    <td className="px-6 py-4 text-center">

                      {application.status === 'pending' && (
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            color="green"
                            onClick={() => approveApplication(application.id)}
                          >
                            Freigeben
                          </Button>
                          <Button
                            color="yellow"
                            onClick={() => rejectApplication(application.id)}
                          >
                            Ablehnen
                          </Button>
                          <Button
                            color="red"
                            onClick={() => deleteApplication(application.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      )}

                      {application.status === 'approved' && (

                        <span className="font-semibold text-blue-700">
                          Wartet auf Telegram-Beitritt
                        </span>

                      )}

                      {application.status === 'active' && (

                        <span className="font-semibold text-green-700">
                          Mitglied
                        </span>

                      )}

                      {application.status === 'rejected' && (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <span className="font-semibold text-red-700">
                            Abgelehnt
                          </span>
                          <Button
                            color="red"
                            onClick={() => deleteApplication(application.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      )}

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </Card>

    </>
  )
}
