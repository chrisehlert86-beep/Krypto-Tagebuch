'use client'

import { APP_NAME } from '@/constants/app'

type PublicSidebarProps = {
  currentStep: number
}

export default function PublicSidebar({
  currentStep,
}: PublicSidebarProps) {
  const steps = [
    'Einladungscode',
    'Persönliche Daten',
    'Disclaimer',
    'Freigabe',
  ]

  return (
    <aside className="flex w-72 flex-col bg-slate-900 text-white">

      <div className="border-b border-slate-700 p-8">

        <h1 className="text-3xl font-bold">
          {APP_NAME}
        </h1>

        <p className="mt-2 text-white">
          Bewerbungsprozess
        </p>

      </div>

      <nav className="flex-1 p-4">

        <ul className="space-y-2">

          {steps.map((step, index) => {

            const stepNumber = index + 1

            const completed = currentStep > stepNumber
            const active = currentStep === stepNumber

            return (

              <li key={step}>

                <div
                  className={`rounded-lg px-4 py-3 transition ${
                    completed
                      ? 'bg-green-600 font-semibold text-white'
                      : active
                        ? 'bg-blue-700 font-bold text-white'
                        : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >

                  <div className="flex items-center gap-3">

                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        completed
                          ? 'bg-green-700'
                          : active
                            ? 'bg-blue-800'
                            : 'bg-slate-700'
                      }`}
                    >
                      {completed ? '✓' : stepNumber}
                    </div>

                    <span>{step}</span>

                  </div>

                </div>

              </li>

            )
          })}

        </ul>

      </nav>

      <div className="border-t border-slate-700 p-4">

        <div className="rounded-lg bg-slate-800 p-4">

          <p className="text-sm text-slate-300">
            Dauer ca. 2 Minuten
          </p>

        </div>

      </div>

    </aside>
  )
}