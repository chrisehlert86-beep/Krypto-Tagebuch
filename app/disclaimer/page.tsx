'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { APP_NAME, DISCLAIMER_VERSION } from '@/constants/app'
import PublicLayout from '@/components/layout/PublicLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

export default function DisclaimerPage() {
  const router = useRouter()
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [disclaimerRead, setDisclaimerRead] = useState(false)
  const [risksUnderstood, setRisksUnderstood] = useState(false)
  const [noAdviceAcknowledged, setNoAdviceAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)

  const allConfirmed = disclaimerRead && risksUnderstood && noAdviceAcknowledged

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight

    if (remaining <= 5) setHasScrolledToBottom(true)
  }

  async function submitApplication() {
    const inviteCode = sessionStorage.getItem('invite_code')
    const firstName = sessionStorage.getItem('first_name')
    const lastName = sessionStorage.getItem('last_name')

    if (!inviteCode || !firstName || !lastName) {
      alert('Die Sitzung ist abgelaufen.')
      router.push('/')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, firstName, lastName }),
      })
      const result = await response.json()

      if (!response.ok) {
        alert(result.error ?? 'Die Bewerbung konnte nicht übermittelt werden.')
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
      alert('Die Bewerbung konnte wegen eines Serverfehlers nicht übermittelt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout currentStep={4}>
      <PageHeader
        title="Wichtige Hinweise und Haftungsausschluss"
        subtitle="Bitte lies den folgenden Text vollständig und aufmerksam."
      />

      <Card>
        <div
          onScroll={handleScroll}
          className="h-[32rem] space-y-7 overflow-y-auto rounded-xl border border-gray-300 bg-white p-6 leading-7 text-black sm:p-8"
          aria-label="Haftungsausschluss"
          tabIndex={0}
        >
          <header className="border-b border-gray-200 pb-5">
            <h2 className="text-2xl font-bold">Haftungsausschluss</h2>
            <p className="mt-2 text-sm text-gray-600">
              {APP_NAME} · Version {DISCLAIMER_VERSION}
            </p>
          </header>

          <DisclaimerSection title="1. Zweck der Community">
            <p>
              {APP_NAME} ist eine private Community zum Austausch über Kryptowährungen,
              Finanzmärkte, Marktbeobachtungen und persönliche Handelsaktivitäten. Die
              bereitgestellten Inhalte dienen ausschließlich allgemeinen Informations-,
              Dokumentations- und Bildungszwecken.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="2. Keine Anlage-, Finanz-, Rechts- oder Steuerberatung">
            <p>
              Sämtliche Beiträge stellen persönliche Meinungen oder Erfahrungen der jeweils
              veröffentlichenden Person dar. Sie sind weder eine individuelle Anlage- oder
              Finanzberatung noch eine Rechts- oder Steuerberatung. Sie sind insbesondere
              keine persönliche Empfehlung, kein Angebot und keine Aufforderung zum Kauf,
              Halten oder Verkauf von Kryptowerten, Wertpapieren oder sonstigen
              Finanzinstrumenten.
            </p>
            <p>
              Die Bezeichnung eines Inhalts als Meinung oder Information ändert nichts an
              seiner rechtlichen Einordnung. Deshalb dürfen in der Community keine
              individuellen Beratungsleistungen oder verbindlichen Handelsanweisungen
              angeboten werden.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="3. Erhebliche Risiken und möglicher Totalverlust">
            <p>
              Kryptowerte und andere spekulative Anlagen unterliegen erheblichen
              Kursschwankungen. Es besteht das Risiko eines teilweisen oder vollständigen
              Verlusts des eingesetzten Kapitals. Weitere Risiken können unter anderem aus
              geringer Liquidität, technischen Fehlern, Cyberangriffen, dem Verlust von
              Zugangsdaten, Betrug, regulatorischen Änderungen oder der Insolvenz eines
              Anbieters entstehen.
            </p>
            <p>
              Vergangene Wertentwicklungen, Simulationen, Prognosen und dargestellte Erfolge
              sind kein verlässlicher Indikator für zukünftige Ergebnisse. Es gibt keine
              Garantie für Gewinne oder den Erhalt des eingesetzten Kapitals.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="4. Eigenverantwortliche Entscheidungen">
            <p>
              Jedes Mitglied trifft sämtliche Anlage- und Handelsentscheidungen selbstständig
              und auf eigenes Risiko. Vor einer Entscheidung sind eigene Nachforschungen
              erforderlich. Dabei sollten insbesondere die persönliche finanzielle Situation,
              Risikotragfähigkeit, Anlageziele und Kenntnisse berücksichtigt werden. Bei
              Unsicherheit ist unabhängiger, entsprechend qualifizierter fachlicher Rat
              einzuholen.
            </p>
            <p>
              Es sollte nur Kapital eingesetzt werden, dessen vollständiger Verlust ohne
              Gefährdung des Lebensunterhalts getragen werden kann. Zugangsdaten, Private Keys,
              Seed-Phrases oder Passwörter dürfen niemals mit anderen Mitgliedern geteilt
              werden.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="5. Richtigkeit und Verfügbarkeit von Informationen">
            <p>
              Inhalte können unvollständig, veraltet oder fehlerhaft sein. Kurse, Kennzahlen,
              Nachrichten und sonstige Daten können aus externen Quellen stammen und zeitlich
              verzögert sein. Eine Gewähr für Richtigkeit, Vollständigkeit, Aktualität oder
              dauerhafte Verfügbarkeit wird nicht übernommen. Inhalte können jederzeit ohne
              vorherige Ankündigung geändert oder entfernt werden.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="6. Beiträge von Mitgliedern und Interessenkonflikte">
            <p>
              Mitglieder sind für ihre eigenen Beiträge verantwortlich. Aussagen anderer
              Mitglieder werden nicht automatisch geprüft oder gebilligt. Verfasser können an
              erwähnten Kryptowerten oder Projekten wirtschaftlich beteiligt sein. Werbung,
              Affiliate-Links, Sponsoring und andere kommerzielle Interessen müssen klar und
              verständlich als solche gekennzeichnet werden.
            </p>
            <p>
              Marktmanipulation, irreführende Erfolgsversprechen, unerlaubte Beratung,
              rechtswidrige Inhalte und die Aufforderung zur Preismanipulation sind untersagt.
              Verdächtige Inhalte sollten unverzüglich einem Administrator gemeldet werden.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="7. Externe Angebote und Links">
            <p>
              Verweise auf externe Webseiten, Börsen, Wallets, Bots oder andere Dienste dienen
              nur der Information. Für deren Inhalte, Sicherheit, Verfügbarkeit und
              Datenschutzpraktiken sind die jeweiligen Anbieter verantwortlich. Vor der
              Nutzung eines externen Angebots sind dessen Bedingungen und Risiken selbst zu
              prüfen.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="8. Haftung">
            <p>
              Die Nutzung der Community und ihrer Inhalte erfolgt auf eigene Verantwortung.
              Soweit gesetzlich zulässig, wird keine Haftung für Entscheidungen, Geschäfte oder
              Verluste übernommen, die allein im Vertrauen auf bereitgestellte Inhalte
              getroffen beziehungsweise verursacht wurden.
            </p>
            <p>
              Unberührt bleibt die Haftung bei Vorsatz und grober Fahrlässigkeit, bei Verletzung
              von Leben, Körper oder Gesundheit sowie in allen weiteren Fällen, in denen eine
              Haftung gesetzlich nicht ausgeschlossen oder beschränkt werden darf.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="9. Kenntnisnahme">
            <p>
              Mit deiner Zustimmung bestätigst du, dass du diese Hinweise vollständig gelesen
              und verstanden hast, die beschriebenen Risiken kennst und deine Entscheidungen
              eigenverantwortlich triffst.
            </p>
          </DisclaimerSection>

          <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
            Stand: 14. Juli 2026. Dieser Text ersetzt keine individuelle rechtliche Prüfung des
            konkreten Community-Angebots.
          </p>
        </div>

        {!hasScrolledToBottom && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="font-medium text-black">
              Bitte scrolle bis zum Ende, um den vollständigen Text zu lesen.
            </p>
          </div>
        )}

        {hasScrolledToBottom && (
          <div className="mt-8 space-y-6">
            <fieldset className="space-y-3">
              <legend className="mb-3 font-bold text-black">
                Bitte bestätige alle drei Punkte:
              </legend>

              <ConfirmationCheckbox
                checked={disclaimerRead}
                onChange={setDisclaimerRead}
                label={`Disclaimer gelesen (Version ${DISCLAIMER_VERSION})`}
              />
              <ConfirmationCheckbox
                checked={risksUnderstood}
                onChange={setRisksUnderstood}
                label="Risiken verstanden"
              />
              <ConfirmationCheckbox
                checked={noAdviceAcknowledged}
                onChange={setNoAdviceAcknowledged}
                label="Keine Anlageberatung"
              />
            </fieldset>

            <Button
              color="blue"
              onClick={submitApplication}
              disabled={!allConfirmed || loading}
            >
              {loading ? 'Bewerbung wird übermittelt …' : 'Bewerbung abschließen'}
            </Button>
          </div>
        )}
      </Card>
    </PublicLayout>
  )
}

function ConfirmationCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 p-4 text-black transition hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0"
      />
      <span className="font-medium">{label}</span>
    </label>
  )
}

function DisclaimerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </section>
  )
}
