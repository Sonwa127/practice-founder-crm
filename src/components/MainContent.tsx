'use client'

import { useTheme } from '@/components/ThemeContext'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { dark } = useTheme()

  return (
    <main className={`flex-1 md:ml-64 h-screen overflow-hidden transition-colors ${
      dark ? 'bg-gray-950 text-white' : 'bg-amber-50 text-gray-900'
    }`}>
      {children}
    </main>
  )
}