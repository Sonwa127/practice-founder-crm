'use client'

// src/components/RoleGuard.tsx
// Drop this on any page that needs role restriction.
// admin role always bypasses every guard.
//
// Usage:
//   export default function DashboardPage() {
//     return (
//       <RoleGuard allow={['admin']}>
//         <ActualPageContent />
//       </RoleGuard>
//     )
//   }

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgUser } from '@/lib/useOrgUser'

// All possible roles in the system
export type PracticeRole =
  | 'admin'
  | 'member'

interface RoleGuardProps {
  /** Roles that ARE allowed to see this page */
  allow: PracticeRole[]
  /** Where to send unauthorized users. Defaults to /dashboard/tasks */
  redirectTo?: string
  children: React.ReactNode
}

export default function RoleGuard({
  allow,
  redirectTo = '/dashboard/tasks',
  children,
}: RoleGuardProps) {
  const router = useRouter()
  const { role, isLoading } = useOrgUser()

  const isAllowed = role === 'admin' || allow.includes(role as PracticeRole)

  useEffect(() => {
    if (isLoading) return
    if (!role || !isAllowed) {
      router.replace(redirectTo)
    }
  }, [role, isLoading, isAllowed, redirectTo, router])

  // Still loading — show spinner to prevent flash
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1410]">
        <div className="w-5 h-5 rounded-full border-2 border-[#c8843a] border-t-transparent animate-spin" />
      </div>
    )
  }

  // Role not allowed — show nothing while redirect happens
  if (!role || !isAllowed) {
    return null
  }

  return <>{children}</>
}