import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Einstellungen"
        subtitle="Konfiguration der Anwendung."
      />

      <Card>

        <div className="space-y-8">

          <section>

            <h2 className="mb-2 text-2xl font-bold text-black">
              Allgemein
            </h2>

            <p className="text-black">
              Weitere Einstellungen werden hier in den nächsten Ausbaustufen
              ergänzt.
            </p>

          </section>

          <hr className="border-gray-300" />

          <section>

            <h2 className="mb-2 text-2xl font-bold text-black">
              Systemstatus
            </h2>

            <div className="space-y-2 text-black">

              <p>
                Anwendung:
                <strong className="ml-2 text-green-700">
                  Online
                </strong>
              </p>

              <p>
                Datenbank:
                <strong className="ml-2 text-green-700">
                  Verbunden
                </strong>
              </p>

            </div>

          </section>

        </div>

      </Card>
    </>
  )
}