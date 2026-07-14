import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import './globals.css'

export const metadata: Metadata = {
  title: 'Krypto-Tagebuch',
  description: 'Administration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-100">

        {children}

        <Toaster
          position="top-right"
          richColors
          closeButton
        />

      </body>
    </html>
  )
}
