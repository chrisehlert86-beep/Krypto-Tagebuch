'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

type Member = {
  id: string
  first_name: string
  last_name: string
  invite_code: string
  role: 'member' | 'admin'
  status: 'active' | 'inactive'
  created_at: string
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  async function loadMembers() {
    try {
      const response = await fetch('/api/admin/members')
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error)
        return
      }

      setMembers(data)

    } catch (error) {
      console.error(error)
      toast.error('Mitglieder konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  async function changeRole(id: string, role: string) {
    try {
      const response = await fetch(
        '/api/admin/members/update-role',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id,
            role,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error)
        return
      }

      toast.success('Rolle geändert.')

      await loadMembers()

    } catch (error) {
      console.error(error)
      toast.error('Rolle konnte nicht geändert werden.')
    }
  }

  async function toggleStatus(id: string) {
    try {
      const response = await fetch(
        '/api/admin/members/toggle-status',
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

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error)
        return
      }

      toast.success('Status geändert.')

      await loadMembers()

    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMembers(), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  if (loading) {
    return (
      <>
        <PageHeader
          title="Mitglieder"
          subtitle="Alle freigegebenen Mitglieder"
        />

        <Card>

          <p className="py-8 text-center text-xl font-semibold text-black">
            Mitglieder werden geladen...
          </p>

        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Mitglieder"
        subtitle="Verwalte alle freigegebenen Mitglieder."
      />

      <Card>

        <div className="overflow-x-auto">

          <table className="min-w-full border border-gray-300">

            <thead className="bg-gray-200">

              <tr>

                <th className="border-b px-6 py-4 text-left font-bold text-black">
                  Name
                </th>

                <th className="border-b px-6 py-4 text-left font-bold text-black">
                  Einladungscode
                </th>

                <th className="border-b px-6 py-4 text-left font-bold text-black">
                  Rolle
                </th>

                <th className="border-b px-6 py-4 text-left font-bold text-black">
                  Status
                </th>

                <th className="border-b px-6 py-4 text-left font-bold text-black">
                  Mitglied seit
                </th>

                <th className="border-b px-6 py-4 text-center font-bold text-black">
                  Aktionen
                </th>

              </tr>

            </thead>

            <tbody>

              {members.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="py-10 text-center text-lg text-black"
                  >
                    Keine Mitglieder vorhanden.
                  </td>

                </tr>

              ) : (

                members.map((member) => (

                  <tr
                    key={member.id}
                    className="border-b hover:bg-blue-50"
                  >

                    <td className="px-6 py-4 font-semibold text-black">
                      {member.first_name} {member.last_name}
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-black">
                      {member.invite_code}
                    </td>

                    <td className="px-6 py-4">

                      <select
                        value={member.role}
                        onChange={(e) =>
                          changeRole(member.id, e.target.value)
                        }
                        className="rounded border border-gray-400 bg-white px-3 py-2 text-black"
                      >

                        <option value="member">
                          Mitglied
                        </option>

                        <option value="admin">
                          Administrator
                        </option>

                      </select>

                    </td>

                    <td className="px-6 py-4">
                      <Badge status={member.status} />
                    </td>

                    <td className="px-6 py-4 text-black">
                      {new Date(member.created_at).toLocaleString('de-DE')}
                    </td>

                    <td className="px-6 py-4 text-center">

                      <Button
                        color={
                          member.status === 'active'
                            ? 'red'
                            : 'green'
                        }
                        onClick={() =>
                          toggleStatus(member.id)
                        }
                      >
                        {member.status === 'active'
                          ? 'Deaktivieren'
                          : 'Aktivieren'}
                      </Button>

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
