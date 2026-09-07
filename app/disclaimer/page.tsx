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
        body: JSON.stringify({
          inviteCode,
          firstName,
          lastName,
          disclaimerRead,
          risksUnderstood,
          noAdviceAcknowledged,
        }),
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
          className="h-[60dvh] min-h-80 max-h-[32rem] space-y-6 overflow-y-auto overscroll-contain rounded-xl border border-gray-300 bg-white p-4 leading-7 text-black sm:space-y-7 sm:p-8"
          aria-label="Haftungsausschluss"
          tabIndex={0}
        >
          <header className="border-b border-gray-200 pb-5">
            <h2 className="text-xl font-bold sm:text-2xl">Haftungsausschluss</h2>
            <p className="mt-2 text-sm text-gray-600">
              {APP_NAME} · Version {DISCLAIMER_VERSION}
            </p>
          </header>

          <DisclaimerSection title="1. Charakter und Zweck von „Tagebuch“">
            <p>
              „Tagebuch“ ist ein privates Trading-Tagebuch und ausdrücklich keine Signalgruppe. Die veröffentlichten Inhalte dienen der Dokumentation meiner persönlichen Marktbeobachtungen, Analysen, Einschätzungen und tatsächlich von mir vorgenommenen bzw. geplanten Handelsentscheidungen.
            </p>
            <p>
              Meine eigenen Trades werden mit einem zeitlichen Versatz veröffentlicht und in „Tagebuch“ dokumentiert. Die Beiträge sind daher insbesondere nicht als Aufforderung gedacht, einen Trade zeitgleich oder zu denselben Konditionen nachzuhandeln.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="2. Keine Anlage-, Finanz- oder Handelsberatung">
            <p>
              Sämtliche in „Tagebuch“ veröffentlichten Inhalte stellen ausschließlich meine persönlichen Einschätzungen und Entscheidungen dar. Sie sind keine individuelle Anlage-, Finanz-, Vermögens- oder Handelsberatung und keine Aufforderung oder Empfehlung zum Kauf, Verkauf oder Halten bestimmter Kryptowährungen, Finanzinstrumente oder sonstiger Vermögenswerte.
            </p>
            <p>
              Es erfolgt keine Prüfung, ob ein dargestellter Trade zu den persönlichen finanziellen Verhältnissen, Kenntnissen, Erfahrungen, Anlagezielen oder zur Risikobereitschaft eines Mitglieds passt.
            </p>
            <p>
              Jeder Nutzer entscheidet eigenverantwortlich, ob, wann, wie und in welchem Umfang er handelt.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="3. Analysemethode und Handelsansatz">
            <p>
              Für meine Kursanalysen verwende ich insbesondere die Elliott-Wellen-Theorie. Dabei konzentriere ich mich auf die übergeordneten Wellen 1–5 sowie A–C. Kleinere Unterstrukturen werden von mir grundsätzlich nicht aktiv gehandelt, da mir diese für meinen persönlichen Handelsansatz zu kurzfristig und hektisch sind.
            </p>
            <p>Mein grundsätzliches Handelsszenario orientiert sich dabei an folgendem Schema:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Welle 1: Long</li>
              <li>Welle 2: Short</li>
              <li>Welle 3: Long</li>
              <li>Welle 4: Short</li>
              <li>Welle 5: Long – vollständiger Verkauf; anschließend gegebenenfalls Reinvestition im Bärenmarkt</li>
              <li>Welle A: Short</li>
              <li>Welle B: grundsätzlich kein Trade; geplanter Wiedereinstieg in eine Short-Position gegebenenfalls am angenommenen Top der B-Welle</li>
              <li>Welle C: Short – vollständiger Verkauf; anschließend gegebenenfalls Reinvestition im folgenden Bullenmarkt</li>
            </ul>
            <p>
              Dieses Schema beschreibt lediglich meinen persönlichen Ansatz. Die Elliott-Wellen-Zählung ist eine interpretative Analysemethode. Eine Wellenzählung kann sich nachträglich als falsch erweisen, muss angepasst werden oder kann von anderen Marktteilnehmern völlig anders bewertet werden. Aus der dargestellten Analyse lässt sich keine Gewissheit über zukünftige Kursentwicklungen ableiten.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="4. Eigene Charts und Analysen">
            <p>
              In „Tagebuch“ veröffentliche ich unter anderem eigene Charts, Wellenzählungen, mögliche Kursziele, Einstiegs- und Ausstiegsbereiche sowie weitere Marktbeobachtungen, auf deren Grundlage ich meine persönlichen Handelsentscheidungen treffe.
            </p>
            <p>
              Auch konkrete Kursmarken, Positionierungen, Einstiege, Ausstiege, Stop-Loss-Bereiche oder andere Angaben zu meinen eigenen Trades stellen keine Aufforderung dar, diese zu übernehmen oder nachzuhandeln.
            </p>
            <p>
              Die Veröffentlichung eines Trades bedeutet insbesondere nicht, dass ein anderer Nutzer denselben Preis, dieselbe Ausführung oder dasselbe Ergebnis erzielen kann.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="5. Erhebliches Verlustrisiko">
            <p>
              Der Handel mit Kryptowährungen und anderen spekulativen Vermögenswerten ist mit erheblichen Risiken verbunden. Dies gilt insbesondere bei Short-Positionen, Derivaten und beim Einsatz von Hebeln.
            </p>
            <p>
              Kurse können sich innerhalb kurzer Zeit erheblich verändern. Handelspositionen können zu erheblichen Verlusten führen. Je nach eingesetztem Produkt besteht das Risiko des vollständigen Verlustes des eingesetzten Kapitals (Totalverlust). Bei bestimmten Produkten oder Vertragsgestaltungen können darüber hinausgehende Risiken bestehen.
            </p>
            <p>
              Frühere Trades, Ergebnisse oder Kursentwicklungen sind kein verlässlicher Indikator für zukünftige Ergebnisse.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="6. Eigenverantwortliches Handeln">
            <p>
              Jeder Nutzer ist für seine Handelsentscheidungen selbst verantwortlich. Vor einer Transaktion sind die jeweiligen Chancen und Risiken eigenständig zu prüfen.
            </p>
            <p>Dies betrifft insbesondere:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Auswahl des Brokers bzw. der Börse,</li>
              <li>Auswahl und Funktionsweise des gehandelten Produkts,</li>
              <li>Positionsgröße,</li>
              <li>Einsatz von Hebeln,</li>
              <li>Long- oder Short-Positionierung,</li>
              <li>Orderart,</li>
              <li>Stop-Loss- und Take-Profit-Einstellungen,</li>
              <li>Gebühren und Finanzierungskosten,</li>
              <li>Liquidationsrisiken sowie</li>
              <li>steuerliche Auswirkungen.</li>
            </ul>
          </DisclaimerSection>

          <DisclaimerSection title="7. Broker, Börsen und technische Ausführung">
            <p>
              Ich habe keinen Einfluss auf die technische Funktionsfähigkeit eines vom Nutzer eingesetzten Brokers, einer Kryptobörse, Wallet oder sonstigen Handelsplattform.
            </p>
            <p>
              Soweit gesetzlich zulässig, übernehme ich keine Haftung für Schäden oder Verluste, die beispielsweise durch Fehlbedienung des eigenen Brokers, falsch eingegebene Orders, fehlerhafte Positionsgrößen, versehentlich eingesetzten Hebel, Liquidationen, technische Störungen, verzögerte oder nicht ausgeführte Orders, Ausfälle einer Handelsplattform oder vergleichbare Umstände entstehen.
            </p>
            <p>
              Jeder Nutzer ist selbst dafür verantwortlich, die Funktionsweise der von ihm verwendeten Handelsplattform und der eingesetzten Ordertypen zu kennen.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="8. Richtigkeit und Aktualität">
            <p>
              Analysen und Einschätzungen geben den Informations- und Meinungsstand zum Zeitpunkt ihrer Erstellung wieder. Finanzmärkte können sich jederzeit verändern. Eine zuvor veröffentlichte Einschätzung kann deshalb bereits kurze Zeit später überholt sein.
            </p>
            <p>
              Trotz sorgfältiger Erstellung kann keine Gewähr für Vollständigkeit, Richtigkeit, Aktualität oder dauerhafte Gültigkeit der veröffentlichten Informationen übernommen werden.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="9. Haftung">
            <p>
              Handelsentscheidungen erfolgen ausschließlich auf eigene Verantwortung und eigenes Risiko.
            </p>
            <p>
              Soweit gesetzlich zulässig, wird keine Haftung für Handels- oder Anlageverluste übernommen, die aufgrund eigener Entscheidungen eines Nutzers oder aufgrund der Verwendung, Interpretation oder Übernahme der in „Tagebuch“ veröffentlichten Informationen entstehen.
            </p>
            <p>
              Zwingende gesetzliche Haftungstatbestände bleiben hiervon unberührt. Insbesondere soll dieser Disclaimer keine Haftung ausschließen oder beschränken, soweit ein solcher Ausschluss gesetzlich nicht zulässig ist.
            </p>
          </DisclaimerSection>

          <DisclaimerSection title="10. Bestätigung">
            <p>
              Mit der Nutzung von „Tagebuch“ bestätige ich, dass ich verstanden habe, dass es sich um die Dokumentation persönlicher Trades und Marktanalysen und nicht um eine Signalgruppe oder individuelle Anlageberatung handelt.
            </p>
            <p>
              Ich treffe sämtliche Handelsentscheidungen eigenverantwortlich und bin mir bewusst, dass spekulativer Handel zu erheblichen Verlusten bis hin zum vollständigen Verlust des eingesetzten Kapitals führen kann.
            </p>
          </DisclaimerSection>
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
                label="Ich habe den Disclaimer vollständig gelesen und verstanden."
              />
              <ConfirmationCheckbox
                checked={risksUnderstood}
                onChange={setRisksUnderstood}
                label="Ich habe die beschriebenen Risiken verstanden und akzeptiere den Haftungsausschluss."
              />
              <ConfirmationCheckbox
                checked={noAdviceAcknowledged}
                onChange={setNoAdviceAcknowledged}
                label="Ich habe verstanden, dass die Inhalte keine Anlage-, Finanz-, Rechts- oder Steuerberatung darstellen."
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
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 text-black transition hover:bg-gray-50 sm:items-center sm:gap-4 sm:p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 sm:mt-0"
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
      <h3 className="text-lg font-extrabold">{title}</h3>
      {children}
    </section>
  )
}
