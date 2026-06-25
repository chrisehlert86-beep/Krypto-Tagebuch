'use client'

import { useState } from 'react'

export default function DisclaimerPage() {
  const [accepted, setAccepted] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Haftungsausschluss
      </h1>

      <div
        className="border p-4 h-96 overflow-y-scroll mb-6"
        onScroll={(e) => {
          const target = e.currentTarget

          const isBottom =
            target.scrollHeight - target.scrollTop <=
            target.clientHeight + 5

          if (isBottom) {
            setHasScrolledToBottom(true)
          }
        }}
      >
        <p>
          HIER KOMMT SPÄTER DEIN DISCLAIMER HINEIN.
        </p>

        <br />

        <p>
          Diese Inhalte dienen ausschließlich der Dokumentation meiner persönlichen
          Marktbeobachtungen und Handelsaktivitäten.
        </p>

        <br />

        <p>
          Es handelt sich ausdrücklich nicht um Anlageberatung,
          Finanzberatung oder eine Aufforderung zum Kauf oder Verkauf
          von Finanzinstrumenten.
        </p>

        <br />

        <p>
          Jeder Teilnehmer handelt ausschließlich auf eigene Verantwortung.
        </p>

        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />

        <p>
          Ende des Dokuments.
        </p>
      </div>

      {hasScrolledToBottom ? (
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Ich habe den Haftungsausschluss gelesen und akzeptiert.
        </label>
      ) : (
        <p className="text-sm text-gray-600">
          Bitte bis zum Ende scrollen, um fortzufahren.
        </p>
      )}

      <button
        disabled={!accepted}
        className="mt-6 bg-black text-white px-6 py-3 rounded disabled:opacity-50"
      >
        Weiter
      </button>
    </main>
  )
}