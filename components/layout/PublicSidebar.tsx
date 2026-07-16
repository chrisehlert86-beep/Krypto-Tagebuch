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
	'Telegram',
    'Disclaimer',
    'Freigabe',
  ]

  return (
    <aside className="flex w-full shrink-0 flex-col bg-slate-900 text-white lg:min-h-screen lg:w-72">

      <div className="border-b border-slate-700 px-4 py-4 sm:px-6 lg:p-8">

        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
          {APP_NAME}
        </h1>

        <p className="mt-1 text-sm text-slate-300 lg:mt-2 lg:text-base lg:text-white">
          Bewerbungsprozess
        </p>

      </div>

      <nav className="flex-1 overflow-x-auto p-3 lg:p-4">

        <ul className="flex min-w-max gap-2 lg:block lg:min-w-0 lg:space-y-2">

          {steps.map((step, index) => {

            const stepNumber = index + 1

            const completed = currentStep > stepNumber
            const active = currentStep === stepNumber

            return (

              <li key={step}>

                <div
                  className={`rounded-lg px-3 py-2.5 transition lg:px-4 lg:py-3 ${
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

                    <span className="whitespace-nowrap text-sm lg:text-base">{step}</span>

                  </div>

                </div>

              </li>

            )
          })}

        </ul>

      </nav>

      <div className="hidden border-t border-slate-700 p-4 lg:block">

        <div className="rounded-lg bg-slate-800 p-4">

          <p className="text-sm text-slate-300">
            Dauer ca. 2 Minuten
          </p>

        </div>

      </div>

    </aside>
  )
}
