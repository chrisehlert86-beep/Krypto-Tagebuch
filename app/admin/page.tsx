'use client'

import { useEffect, useState } from 'react'

import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'

type Stats = {
  pending: number
  approved: number
  members: number
  invites: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    approved: 0,
    members: 0,
    invites: 0,
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Übersicht über den aktuellen Status."
      />

      {loading ? (
        <p className="text-lg font-semibold text-black">
          Dashboard wird geladen...
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Offene Bewerbungen"
            value={stats.pending}
            color="yellow"
          />

          <StatCard
            title="Freigegeben"
            value={stats.approved}
            color="green"
          />

          <StatCard
            title="Mitglieder"
            value={stats.members}
            color="blue"
          />

          <StatCard
            title="Einladungscodes"
            value={stats.invites}
            color="purple"
          />
        </div>
      )}
    </>
  )
}