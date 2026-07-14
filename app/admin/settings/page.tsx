'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

type SystemStatus = {
  websiteOnline: boolean
  supabaseReachable: boolean
  supabaseResponseTimeMs: number
  botOnline: boolean
  lastHeartbeat: string | null
  botVersion?: string | null
}

function StatusValue({ online, onlineText, offlineText }: {
  online: boolean
  onlineText: string
  offlineText: string
}) {
  return (
    <strong className={online ? 'text-green-700' : 'text-red-700'}>
      {online ? onlineText : offlineText}
    </strong>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningCommand, setRunningCommand] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/system-status', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Systemstatus konnte nicht geladen werden.')
      setStatus(result)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Systemstatus konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  async function sendCommand(command: 'restart' | 'test_message') {
    if (command === 'restart' && !confirm('Telegram-Bot wirklich neu starten?')) return

    setRunningCommand(command)
    try {
      const response = await fetch('/api/admin/bot-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Bot-Befehl fehlgeschlagen.')

      toast.success(command === 'restart' ? 'Neustart angefordert.' : 'Testnachricht angefordert.')
      window.setTimeout(() => void loadStatus(), 3000)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Bot-Befehl fehlgeschlagen.')
    } finally {
      setRunningCommand(null)
    }
  }

  useEffect(() => {
    void loadStatus()
    const interval = window.setInterval(() => void loadStatus(), 15_000)
    return () => window.clearInterval(interval)
  }, [loadStatus])

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Systemstatus und sichere Bot-Steuerung." />

      <div className="space-y-6 text-black">
        <Card>
          <h2 className="mb-6 text-2xl font-bold">Systemstatus</h2>

          {loading && !status ? (
            <p className="font-semibold">Systemstatus wird geladen...</p>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="font-semibold text-gray-600">Webseite</dt>
                <dd className="mt-1 text-lg">
                  <StatusValue online={status?.websiteOnline === true} onlineText="Online" offlineText="Offline" />
                </dd>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="font-semibold text-gray-600">Supabase</dt>
                <dd className="mt-1 text-lg">
                  <StatusValue online={status?.supabaseReachable === true} onlineText="Erreichbar" offlineText="Nicht erreichbar" />
                </dd>
                {status?.supabaseReachable && (
                  <p className="mt-1 text-sm text-gray-600">Antwortzeit: {status.supabaseResponseTimeMs} ms</p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="font-semibold text-gray-600">Telegram-Bot</dt>
                <dd className="mt-1 text-lg">
                  <StatusValue online={status?.botOnline === true} onlineText="Online" offlineText="Offline" />
                </dd>
                {status?.botVersion && <p className="mt-1 text-sm text-gray-600">Version: {status.botVersion}</p>}
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="font-semibold text-gray-600">Letzter Bot-Heartbeat</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {status?.lastHeartbeat
                    ? new Date(status.lastHeartbeat).toLocaleString('de-DE')
                    : 'Noch nicht empfangen'}
                </dd>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-2xl font-bold">Bot-Steuerung</h2>
          <p className="mb-6 text-gray-700">
            Es werden ausschließlich fest definierte Befehle ausgeführt. Ein Shell- oder SSH-Zugriff ist nicht möglich.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              color="blue"
              disabled={runningCommand !== null || status?.botOnline !== true}
              onClick={() => void sendCommand('test_message')}
            >
              {runningCommand === 'test_message' ? 'Wird gesendet...' : 'Testnachricht senden'}
            </Button>
            <Button
              color="red"
              disabled={runningCommand !== null || status?.botOnline !== true}
              onClick={() => void sendCommand('restart')}
            >
              {runningCommand === 'restart' ? 'Neustart läuft...' : 'Bot neu starten'}
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
