import { ThemeProvider } from '@/components/ThemeContext'
import Sidebar from '@/components/Sidebar'
import MainContent from '@/components/MainContent'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </ThemeProvider>
  )
}