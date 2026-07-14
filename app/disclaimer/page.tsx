'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { APP_NAME } from '@/constants/app'

import PublicLayout from '@/components/layout/PublicLayout'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function DisclaimerPage() {
  const router = useRouter()

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight

    if (remaining <= 5) {
      setHasScrolledToBottom(true)
    }
  }

  async function submitApplication() {
    const inviteCode = sessionStorage.getItem('invite_code')
    const firstName = sessionStorage.getItem('first_name')
    const lastName = sessionStorage.getItem('last_name')

    if (
      !inviteCode ||
      !firstName ||
      !lastName
    ) {
      alert('Die Sitzung ist abgelaufen.')

      router.push('/')

      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/submit-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode,
          firstName,
          lastName,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error)
        setLoading(false)
        return
      }

      sessionStorage.removeItem('invite_code')
      sessionStorage.removeItem('first_name')
      sessionStorage.removeItem('last_name')
      sessionStorage.removeItem('telegram_user_id')
      sessionStorage.removeItem('telegram_username')

      router.push('/success')

    } catch (error) {

      console.error(error)

      alert('Serverfehler.')

      setLoading(false)
    }
  }

  return (
    <PublicLayout currentStep={4}>

      <PageHeader
        title={APP_NAME}
        subtitle="Bitte lies den Haftungsausschluss vollständig."
      />

      <Card>

        <div
          onScroll={handleScroll}
          className="h-48 overflow-y-auto rounded-xl border border-gray-300 bg-white p-8 leading-7 text-black"
        >

          <h2 className="mb-6 text-2xl font-bold">
            Haftungsausschluss
          </h2>

          <p>
            Diese Inhalte dienen ausschließlich der Dokumentation meiner
            persönlichen Marktbeobachtungen und Handelsaktivitäten.
          </p>

          <br />

          <p>
            Es handelt sich ausdrücklich nicht um eine Anlageberatung,
            Finanzberatung oder eine Aufforderung zum Kauf oder Verkauf
            von Finanzinstrumenten.
          </p>

          <br />

          <p>
            Jeder Teilnehmer handelt ausschließlich auf eigenes Risiko.
          </p>

        </div>

        {!hasScrolledToBottom && (
          <div className="mt-6 rounded-lg bg-yellow-50 p-4">
            <p className="font-medium text-black">
              Bitte lies den Disclaimer vollständig bis zum Ende.
            </p>
          </div>
        )}

        {hasScrolledToBottom && (
          <div className="mt-8 space-y-6">

            <label className="flex items-start gap-4">

              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-5 w-5"
              />

              <span className="text-black">
                Ich habe den Haftungsausschluss vollständig gelesen und akzeptiere ihn.
              </span>

            </label>

            <Button
              color="blue"
              onClick={submitApplication}
              disabled={!accepted || loading}
            >
              {loading
                ? 'Bewerbung wird übermittelt...'
                : 'Bewerbung abschließen'}
            </Button>

          </div>
        )}

      </Card>

    </PublicLayout>
  )
}
