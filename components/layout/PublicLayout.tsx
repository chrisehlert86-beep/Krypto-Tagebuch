'use client'

import PublicSidebar from './PublicSidebar'

type PublicLayoutProps = {
  children: React.ReactNode
  currentStep: number
}

export default function PublicLayout({
  children,
  currentStep,
}: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-100 lg:flex-row">

      <PublicSidebar currentStep={currentStep} />

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:p-8 lg:p-10">

        <div className="mx-auto w-full max-w-6xl">
          {children}
        </div>

      </main>

    </div>
  )
}
