import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/components/QueryProvider'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Practice Founder',
  description: 'Practice Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}