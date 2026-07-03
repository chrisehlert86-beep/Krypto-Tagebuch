'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PublicLayout from '@/components/layout/PublicLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import TelegramLogin from '@/components/telegram/TelegramLogin'

export default function TelegramPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  async function simulateTelegramLogin() {
    setLoading(true)

    /*
     * Diese Demo wird im nächsten Schritt
     * durch das offizielle Telegram Login Widget ersetzt.
     */

    sessionStorage.setItem(
      'telegram_user_id',
      '123456789'
    )

    sessionStorage.setItem(
      'telegram_username',
      'DemoUser'
    )

    router.push('/disclaimer')
  }

  return (
    <PublicLayout currentStep={3}>

      <PageHeader
        title="Telegram verbinden"
        subtitle="Verbinde deinen Telegram Account für den späteren Community-Zugang."
      />

      <Card>

        <div className="space-y-8">

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">

            <h2 className="mb-3 text-xl font-bold text-black">
              Warum Telegram?
            </h2>

            <p className="text-black">
              Der Community-Zugang erfolgt ausschließlich über Telegram.
              Durch die Verbindung deines Accounts kann dein Zugang nach
              der Freigabe automatisch aktiviert werden.
            </p>

          </div>

          <div className="rounded-xl border border-gray-300 bg-gray-50 p-8">

  <h2 className="mb-4 text-xl font-bold text-black">
    Telegram verbinden
  </h2>

  <p className="mb-8 text-gray-700">
    Melde dich mit deinem Telegram-Account an.
  </p>

  <TelegramLogin
    onSuccess={() => router.push('/disclaimer')}
  />

</div>

        </div>

      </Card>

    </PublicLayout>
  )
}