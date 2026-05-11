'use client'

import { useOrgUser } from '@/lib/useOrgUser'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// All valid role strings — new 4-role system + old 'admin'/'member' as aliases
type Role =
  | 'pf_admin'
  | 'pf_team'
  | 'client_owner'
  | 'client_staff'
  | 'admin'    // legacy alias
  | 'member'   // legacy alias

interface RoleGuardProps {
  allow: Role[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

function normalise(role: string | null): string {
  if (role === 'admin') return 'pf_admin'
  if (role === 'member') return 'client_staff'
  return role ?? ''
}

export default function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
  const { role, isLoading } = useOrgUser()
  const router = useRouter()

  const normalisedAllow = allow.flatMap(r => {
    if (r === 'admin') return ['pf_admin', 'pf_team', 'client_owner', 'admin']
    if (r === 'member') return ['client_staff', 'member']
    return [r]
  })

  const normalisedRole = normalise(role)
  const allowed = !isLoading && role !== null && normalisedAllow.includes(normalisedRole)

  useEffect(() => {
    if (!isLoading && role !== null && !normalisedAllow.includes(normalisedRole)) {
      router.replace('/dashboard/tasks')
    }
  }, [isLoading, role])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex items-center justify-center">
        <div className="text-[#c8843a] text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!allowed) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="min-h-screen bg-[#1a1410] flex flex-col items-center justify-center gap-3 text-center p-8">
        <div className="text-3xl">🔒</div>
        <h2 className="text-white text-lg font-semibold">Access Restricted</h2>
        <p className="text-[#c4b49a] text-sm max-w-xs">
          You don't have permission to view this section.
        </p>
      </div>
    )
  }

  return <>{children}</>
}