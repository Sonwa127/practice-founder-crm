'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export interface OrgUser {
  userId: string
  orgId: string
  employeeId: string | null
  employeeName: string | null
  email: string | null
  role: string | null
  isLoading: boolean
  isAdmin: boolean
  isMember: boolean
  canViewAll: boolean
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useOrgUser(): OrgUser {
  const [state, setState] = useState<OrgUser>({
    userId: '',
    orgId: '',
    employeeId: null,
    employeeName: null,
    email: null,
    role: null,
    isLoading: true,
    isAdmin: false,
    isMember: false,
    canViewAll: false,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setState(s => ({ ...s, isLoading: false }))
          return
        }

        let role: string | null = null
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          role = userData?.role ?? null
        } catch {}

        let employee: { id: string; org_id: string } | null = null
        try {
          const { data } = await supabase
            .from('employees')
            .select('id, org_id')
            .eq('linked_user', user.id)
            .single()
          employee = data
        } catch {
          try {
            const { data } = await supabase
              .from('employees')
              .select('id, org_id')
              .eq('email', user.email!)
              .single()
            employee = data
          } catch {}
        }

        const isAdmin    = role === 'admin'
        const isMember   = role === 'member'
        const canViewAll = isAdmin

        setState({
          userId:       user.id,
          orgId:        employee?.org_id ?? '',
          employeeId:   employee?.id ?? null,
          employeeName: user.email ?? null,
          email:        user.email ?? null,
          role,
          isLoading:    false,
          isAdmin,
          isMember,
          canViewAll,
        })

      } catch {
        setState(s => ({ ...s, isLoading: false }))
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  return state
}

export function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}