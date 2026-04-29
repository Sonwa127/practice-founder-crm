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
  // Role booleans — generic, no tenant-specific names
  isPracticeFounder: boolean
  isPracticeManager: boolean
  isOperationsManager: boolean
  isReceptionist: boolean
  isBillingStaff: boolean
  canViewAll: boolean   // practice_founder | practice_manager | dr_evans (legacy)
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
    isPracticeFounder: false,
    isPracticeManager: false,
    isOperationsManager: false,
    isReceptionist: false,
    isBillingStaff: false,
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

        // 2. Get role from users table (role lives here, not employees)
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

        // 4. Derive role booleans
        const isPracticeFounder   = role === 'practice_founder'
        const isPracticeManager   = role === 'practice_manager'
        const isOperationsManager = role === 'operations_manager'
        const isReceptionist      = role === 'receptionist'
        const isBillingStaff      = role === 'billing_staff'
        const canViewAll          = role === 'practice_founder'
                                  || role === 'practice_manager'
                                  || role === 'dr_evans' // legacy role — still supported

        setState({
          userId:             user.id,
          orgId:              employee?.org_id ?? '',
          employeeId:         employee?.id ?? null,
          employeeName:       employee?.name ?? user.email ?? null,
          email:              user.email ?? null,
          role,
          isLoading:          false,
          isPracticeFounder,
          isPracticeManager,
          isOperationsManager,
          isReceptionist,
          isBillingStaff,
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