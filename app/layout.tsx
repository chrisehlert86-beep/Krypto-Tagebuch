import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'

import './globals.css'

const geist = Geist({
  subsets: ['latin'],
})

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
    <html lang="de" className={geist.className}>
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