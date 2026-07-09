'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'

type Stats = {
  pending: number
  members: number
  invites: {
    total: number
    available: number
  }
}

export default function AdminDashboard() {
  const router = useRouter()

  const [stats, setStats] = useState<Stats>({
    pending: 0,
    members: 0,
    invites: {
      total: 0,
      available: 0,
    },
  })

  const [loading, setLoading] = useState(true)

  async function loadStats() {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()

      if (response.ok) {
        setStats(data)
      } else {
        console.error(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="Übersicht über den aktuellen Status."
        />

        <p className="text-lg font-semibold text-black">
          Dashboard wird geladen...
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Übersicht über den aktuellen Status."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        <div
          onClick={() => router.push('/admin/applications')}
          className="cursor-pointer transition duration-200 hover:scale-[1.02]"
        >
          <StatCard
            title="Offene Bewerbungen"
            value={stats.pending}
            color="yellow"
          />
        </div>

        <div
          onClick={() => router.push('/admin/members')}
          className="cursor-pointer transition duration-200 hover:scale-[1.02]"
        >
          <StatCard
            title="Mitglieder"
            value={stats.members}
            color="green"
          />
        </div>

        <div
          onClick={() => router.push('/admin/invites')}
          className="cursor-pointer transition duration-200 hover:scale-[1.02]"
        >
          <StatCard
            title="Einladungscodes"
            primaryValue={stats.invites.total}
            secondaryValue={stats.invites.available}
            primaryLabel="Gesamt"
            secondaryLabel="Verfügbar"
            color="purple"
          />
        </div>

      </div>
    </>
  )
}