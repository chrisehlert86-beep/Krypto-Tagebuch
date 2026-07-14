'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PublicLayout from '@/components/layout/PublicLayout'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function ApplicationPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  function nextStep() {
    const inviteCode = sessionStorage.getItem('invite_code')

    if (!inviteCode) {
      alert('Der Einladungscode ist nicht mehr vorhanden.')

      router.push('/')

      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      alert('Bitte gib deinen Vor- und Nachnamen ein.')
      return
    }

    sessionStorage.setItem('first_name', firstName.trim())
    sessionStorage.setItem('last_name', lastName.trim())

    router.push('/telegram')
  }

  return (
    <PublicLayout currentStep={2}>

      <PageHeader
        title="Persönliche Angaben"
        subtitle="Bitte vervollständige deine persönlichen Daten."
      />

      <Card>

        <div className="max-w-2xl space-y-6">

          <div>

            <label className="mb-2 block font-semibold text-black">
              Vorname *
            </label>

            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Max"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-black outline-none transition focus:border-blue-600"
            />

          </div>

          <div>

            <label className="mb-2 block font-semibold text-black">
              Nachname *
            </label>

            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Mustermann"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-black outline-none transition focus:border-blue-600"
            />

          </div>

          <div className="pt-4">

            <Button
              color="blue"
              onClick={nextStep}
            >
              Weiter zum Disclaimer
            </Button>

          </div>

        </div>

      </Card>

    </PublicLayout>
  )
}
