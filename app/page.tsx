'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { APP_NAME } from '@/constants/app'
import { supabase } from '@/lib/supabase'

import PublicLayout from '@/components/layout/PublicLayout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'

export default function Home() {
  const router = useRouter()

  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkInvite() {
    const code = inviteCode.trim().toUpperCase()

    if (!code) {
      setMessage('Bitte gib deinen Einladungscode ein.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('invites')
      .select('invite_code')
      .eq('invite_code', code)
      .eq('active', true)
      .eq('used', false)
      .maybeSingle()

    setLoading(false)

    if (error) {
      setMessage('Beim Prüfen des Einladungscodes ist ein Fehler aufgetreten.')
      return
    }

    if (!data) {
      setMessage('Der Einladungscode ist ungültig oder wurde bereits verwendet.')
      return
    }

    sessionStorage.setItem('invite_code', code)

    router.push('/application')
  }

  return (
    <PublicLayout currentStep={1}>

      <PageHeader
        title={APP_NAME}
        subtitle="Bitte gib deinen persönlichen Einladungscode ein."
      />

      <Card>

        <div className="space-y-6">

          <div>

            <label className="mb-2 block font-semibold text-black">
              Einladungscode
            </label>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-black focus:border-blue-600 focus:outline-none"
            />

          </div>

          {message && (
            <p className="font-medium text-red-600">
              {message}
            </p>
          )}

          <Button
            color="blue"
            onClick={checkInvite}
            disabled={loading}
          >
            {loading
              ? 'Einladungscode wird geprüft...'
              : 'Weiter'}
          </Button>

        </div>

      </Card>

    </PublicLayout>
  )
}