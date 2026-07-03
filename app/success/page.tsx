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
    <PublicLayout currentStep={4}>

      <PageHeader
        title="Bewerbung erfolgreich eingereicht"
        subtitle="Vielen Dank für deine Anfrage."
      />

      <Card>

        <div className="max-w-3xl space-y-8">

          <div className="rounded-xl border border-green-200 bg-green-50 p-6">

            <h2 className="mb-3 text-2xl font-bold text-green-700">
              ✓ Bewerbung erfolgreich übermittelt
            </h2>

            <p className="text-black">
              Deine Bewerbung für <strong>{APP_NAME}</strong> wurde erfolgreich gespeichert.
            </p>

          </div>

          <div>

            <h3 className="mb-3 text-xl font-semibold text-black">
              Nächster Schritt
            </h3>

            <p className="mb-4 text-black">
              Stelle jetzt bitte eine Beitrittsanfrage für unsere Telegram-Gruppe.
            </p>

            <p className="text-black">
              Nach erfolgreicher Prüfung deiner Bewerbung wirst du für die
              Community freigeschaltet und erhältst Zugriff auf alle Inhalte.
            </p>

          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">

            <h3 className="mb-3 text-lg font-semibold text-blue-700">
              Telegram beitreten
            </h3>

            <p className="mb-6 text-black">
              Klicke auf den Button und stelle deine Beitrittsanfrage.
            </p>

            <a
              href={TELEGRAM_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button color="blue">
                Telegram-Gruppe öffnen
              </Button>
            </a>

          </div>

          <div className="rounded-lg border border-gray-300 bg-gray-50 p-5">

            <p className="text-sm text-gray-700">
              <strong>Hinweis:</strong> Die Freischaltung erfolgt manuell.
              Bitte habe etwas Geduld. Sobald deine Bewerbung geprüft wurde,
              erhältst du Zugriff auf die Community.
            </p>

          </div>

        </div>

      </Card>

    </PublicLayout>
  )
}