import {
  APP_NAME,
  TELEGRAM_GROUP_URL,
} from '@/constants/app'

import PublicLayout from '@/components/layout/PublicLayout'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function SuccessPage() {
  return (
    <PublicLayout currentStep={5}>

      <PageHeader
        title="Bewerbung erfolgreich eingereicht"
        subtitle="Der erste Schritt ist geschafft."
      />

      <Card>

        <div className="space-y-8">

          <div className="rounded-xl border border-green-200 bg-green-50 p-6">

            <h2 className="mb-3 text-2xl font-bold text-green-700">
              ✓ Bewerbung erfolgreich übermittelt
            </h2>

            <p className="text-black">
              Vielen Dank für deine Bewerbung bei <strong>{APP_NAME}</strong>.
            </p>

          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">

            <h3 className="mb-6 text-xl font-bold text-black">
              So geht es jetzt weiter
            </h3>

            <div className="space-y-5">

              <div className="flex items-center gap-3">
                <span className="text-xl">✅</span>
                <span className="text-black">
                  Bewerbung eingegangen
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl">1️⃣</span>
                <span className="text-black">
                  Klicke jetzt auf <strong>„Telegram-Gruppe beitreten“</strong>
                  und sende deine Beitrittsanfrage.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl">2️⃣</span>
                <span className="text-black">
                  Ein Administrator prüft deine Bewerbung.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl">3️⃣</span>
                <span className="text-black">
                  Nach der Freigabe bestätigt unser Bot deine
                  Telegram-Anfrage automatisch.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl">🎉</span>
                <span className="text-black">
                  Du bist sofort Mitglied der Community.
                </span>
              </div>

            </div>

            <div className="mt-10 flex justify-center">

              <a
                href={TELEGRAM_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button color="blue">
                  Telegram-Gruppe beitreten
                </Button>
              </a>

            </div>

            <p className="mt-6 text-center text-sm text-gray-600">
              Deine Beitrittsanfrage wird zunächst von Telegram gespeichert.
              Nach der Freigabe durch einen Administrator,
              wirst du automatisch in die Gruppe aufgenommen.
            </p>

          </div>

        </div>

      </Card>

    </PublicLayout>
  )
}