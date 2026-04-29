'use client'

// src/components/RoleGuard.tsx
// Drop this on any page that needs role restriction.
// It reads the role from useOrgUser and redirects if not allowed.
//
// Usage:
//   export default function DashboardPage() {
//     return (
//       <RoleGuard allow={['dr_evans', 'operations_manager']}>
//         <ActualPageContent />
//       </RoleGuard>
//     )
//   }

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgUser } from '@/lib/useOrgUser'

// All possible roles in the system
export type PracticeRole =
  | 'dr_evans'
  | 'operations_manager'
  | 'receptionist'
  | 'billing_staff'
  | 'practice_manager'
  | 'practice_founder'

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

  useEffect(() => {
    if (isLoading) return
    // No role means unauthenticated or no employee record
    if (!role || !allow.includes(role as PracticeRole)) {
      router.replace(redirectTo)
    }
  }, [role, isLoading, allow, redirectTo, router])

  // Still loading — show nothing to prevent flash
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1410]">
        <div className="w-5 h-5 rounded-full border-2 border-[#c8843a] border-t-transparent animate-spin" />
      </div>
    )
  }

  // Role not allowed — show nothing while redirect happens
  if (!role || !allow.includes(role as PracticeRole)) {
    return null
  }

  return <>{children}</>
}