'use client'

import { useCallback, useEffect, useState } from 'react'

import PublicLayout from '@/components/layout/PublicLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

type ApplicationStatus = {
  status: 'pending' | 'approved' | 'active' | 'rejected'
  telegramInviteLink: string | null
  telegramInviteLinkExpiresAt: string | null
  telegramInviteExpired: boolean
}

export default function SuccessPage() {
  const [application, setApplication] = useState<ApplicationStatus | null>(null)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/application/status', {
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? 'Der Bewerbungsstatus konnte nicht geladen werden.')
        return
      }

      setApplication(result)
      setError('')
    } catch (statusError) {
      console.error(statusError)
      setError('Der Bewerbungsstatus konnte nicht geladen werden.')
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadStatus(), 0)
    const interval = window.setInterval(() => void loadStatus(), 5_000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [loadStatus])

  const inviteExpired = application?.telegramInviteExpired ?? false

  return (
    <PublicLayout currentStep={5}>
      <PageHeader
        title="Bewerbung eingereicht"
        subtitle="Hier siehst du den aktuellen Stand deiner Aufnahme."
      />

      <Card>
        <div className="space-y-6 text-black">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
              {error}
            </div>
          )}

          {!application && !error && (
            <p className="py-8 text-center font-semibold">
              Bewerbungsstatus wird geladen …
            </p>
          )}

          {application?.status === 'pending' && (
            <StatusPanel
              tone="blue"
              title="Bewerbung wartet auf Freigabe"
              text="Deine Daten und dein Telegram-Konto wurden sicher übermittelt. Sobald ein Administrator dich freigibt, erstellt der Bot deinen persönlichen Beitrittslink. Diese Seite aktualisiert sich automatisch."
            />
          )}

          {application?.status === 'approved' && !application.telegramInviteLink && (
            <StatusPanel
              tone="green"
              title="Freigabe erteilt"
              text="Der Bot erstellt gerade deinen persönlichen Telegram-Beitrittslink. Das dauert normalerweise nur wenige Sekunden."
            />
          )}

          {application?.status === 'approved' && application.telegramInviteLink && !inviteExpired && (
            <div className="rounded-xl border border-green-300 bg-green-50 p-4 sm:p-6">
              <h2 className="mb-3 text-xl font-bold text-green-800 sm:text-2xl">
                Du wurdest freigegeben
              </h2>
              <p className="mb-6 leading-7">
                Öffne jetzt deinen persönlichen Link und sende die Telegram-Beitrittsanfrage.
                Der Bot prüft deine Telegram-ID und nimmt dich anschließend automatisch auf.
              </p>
              <a
                href={application.telegramInviteLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button color="blue">Telegram-Beitrittsanfrage senden</Button>
              </a>
              {application.telegramInviteLinkExpiresAt && (
                <p className="mt-4 text-sm text-gray-700">
                  Link gültig bis{' '}
                  {new Date(application.telegramInviteLinkExpiresAt).toLocaleString('de-DE')} Uhr.
                </p>
              )}
            </div>
          )}

          {application?.status === 'approved' && inviteExpired && (
            <StatusPanel
              tone="yellow"
              title="Beitrittslink abgelaufen"
              text="Dein persönlicher Link ist abgelaufen. Bitte wende dich an einen Administrator, damit ein neuer Link erstellt werden kann."
            />
          )}

          {application?.status === 'active' && (
            <StatusPanel
              tone="green"
              title="Willkommen in der Community"
              text="Deine Telegram-Beitrittsanfrage wurde bestätigt und deine Mitgliedschaft ist aktiv."
            />
          )}

          {application?.status === 'rejected' && (
            <StatusPanel
              tone="red"
              title="Bewerbung nicht freigegeben"
              text="Deine Bewerbung wurde abgelehnt. Es wurde kein Telegram-Zugang erstellt."
            />
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="mb-3 font-bold">Der sichere Ablauf</h3>
            <ol className="list-decimal space-y-2 pl-5 text-gray-800">
              <li>Ein Administrator prüft und entscheidet über deine Bewerbung.</li>
              <li>Nach der Freigabe erstellt der Bot einen persönlichen, befristeten Link.</li>
              <li>Du sendest darüber deine Telegram-Beitrittsanfrage.</li>
              <li>Der Bot gleicht Telegram-ID, Link und Bewerbung ab und aktiviert dich.</li>
            </ol>
          </div>
        </div>
      </Card>
    </PublicLayout>
  )
}

function StatusPanel({
  tone,
  title,
  text,
}: {
  tone: 'blue' | 'green' | 'yellow' | 'red'
  title: string
  text: string
}) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }

  return (
    <div className={`rounded-xl border p-4 sm:p-6 ${colors[tone]}`}>
      <h2 className="mb-3 text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="leading-7">{text}</p>
    </div>
  )
}
