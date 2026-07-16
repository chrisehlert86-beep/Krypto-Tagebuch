'use client'

import { useRouter } from 'next/navigation'

import PublicLayout from '@/components/layout/PublicLayout'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import TelegramLogin from '@/components/telegram/TelegramLogin'

export default function TelegramPage() {
  const router = useRouter()

  return (
    <PublicLayout currentStep={3}>

      <PageHeader
        title="Telegram verbinden"
        subtitle="Verbinde deinen Telegram Account für den späteren Community-Zugang."
      />

      <Card>

        <div className="space-y-8">

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-6">

            <h2 className="mb-3 text-xl font-bold text-black">
              Warum Telegram?
            </h2>

            <p className="text-black">
              Der Community-Zugang erfolgt ausschließlich über Telegram.
              Durch die Verbindung deines Accounts kann dein Zugang nach
              der Freigabe automatisch aktiviert werden.
            </p>

          </div>

          <div className="overflow-hidden rounded-xl border border-gray-300 bg-gray-50 p-4 sm:p-8">

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
