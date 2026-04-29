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
  isAdmin: boolean    // role === 'admin' — full access to everything
  isMember: boolean   // role === 'member' — basic access
  canViewAll: boolean // alias for isAdmin, used in page-level logic
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
        // 1. Get logged-in user from Supabase auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setState(s => ({ ...s, isLoading: false }))
          return
        }

        // 2. Get role from users table
        let role: string | null = null
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          role = userData?.role ?? null
        } catch {
          // users table query failed — role stays null, app still loads
        }

        // 3. Get employee record — org_id lives here
        //    Try linked_user first, fall back to email match
        let employee: { id: string; org_id: string; name: string } | null = null
        try {
          const { data } = await supabase
            .from('employees')
            .select('id, org_id, name')
            .eq('linked_user', user.id)
            .single()
          employee = data
        } catch {
          try {
            const { data } = await supabase
              .from('employees')
              .select('id, org_id, name')
              .eq('email', user.email!)
              .single()
            employee = data
          } catch {
            // employee not found — continue with nulls
          }
        }

        // 4. Derive role booleans — simple: admin or member
        const isAdmin   = role === 'admin'
        const isMember  = role === 'member'
        const canViewAll = isAdmin

        setState({
          userId:      user.id,
          orgId:       employee?.org_id ?? '',
          employeeId:  employee?.id ?? null,
          employeeName: employee?.name ?? user.email ?? null,
          email:       user.email ?? null,
          role,
          isLoading:   false,
          isAdmin,
          isMember,
          canViewAll,
        })

      } catch {
        // Safety net — always exit loading state even on unexpected errors
        setState(s => ({ ...s, isLoading: false }))
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  return state
}

// ── Helper: scoped supabase client (RLS handles org filtering automatically)
export function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}