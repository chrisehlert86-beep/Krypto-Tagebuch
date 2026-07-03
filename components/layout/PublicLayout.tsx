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
    <div className="flex min-h-screen bg-gray-100">

      <PublicSidebar currentStep={currentStep} />

      <main className="flex-1 overflow-y-auto p-10">

        <div className="mx-auto max-w-6xl">
          {children}
        </div>

      </main>

    </div>
  )
}