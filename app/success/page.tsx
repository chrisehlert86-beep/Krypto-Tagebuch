import { APP_NAME } from '@/constants/app'

import PublicLayout from '@/components/layout/PublicLayout'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function SuccessPage() {
  return (
    <PublicLayout currentStep={5}>

      <PageHeader
        title="Bewerbung erfolgreich eingereicht"
        subtitle="Vielen Dank für deine Bewerbung."
      />

      <Card>

        <div className="space-y-8">

          <div className="rounded-xl border border-green-200 bg-green-50 p-6">

            <h2 className="mb-3 text-2xl font-bold text-green-700">
              ✓ Bewerbung erfolgreich übermittelt
            </h2>

            <p className="text-black">
              Deine Bewerbung für <strong>{APP_NAME}</strong> wurde erfolgreich gespeichert.
            </p>

          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">

            <h3 className="mb-3 text-xl font-bold text-black">
              Nächster Schritt
            </h3>

            <p className="text-black">
              ○ Freigabe durch Admin
            </p>

            <p className="mt-4 text-gray-700">
              Deine Bewerbung wird nun geprüft. Nach erfolgreicher
              Freigabe erhältst du automatisch Zugriff auf die Telegram-Community.
            </p>

          </div>

        </div>

      </Card>

    </PublicLayout>
  )
}