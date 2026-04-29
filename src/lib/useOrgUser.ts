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
  canViewAll: boolean   // practice_founder | practice_manager | dr_evans
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
      // 1. Get logged-in user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState(s => ({ ...s, isLoading: false }))
        return
      }

      // 2. Get role from users table (role lives here, not employees)
      const { data: userData } = await supabase
        .from('users')
        .select('role, org_id')
        .eq('id', user.id)
        .single()

      const role = userData?.role ?? null

      // 3. Get employee record via linked_user
      const { data: employee } = await supabase
        .from('employees')
        .select('id, name, email')
        .eq('linked_user', user.id)
        .single()

      // 4. Derive role booleans — canViewAll covers all full-access roles
      const isPracticeFounder   = role === 'practice_founder'
      const isPracticeManager   = role === 'practice_manager'
      const isOperationsManager = role === 'operations_manager'
      const isReceptionist      = role === 'receptionist'
      const isBillingStaff      = role === 'billing_staff'
      const canViewAll          = role === 'practice_founder'
                                || role === 'practice_manager'
                                || role === 'dr_evans'  // legacy role — still supported

      setState({
        userId:             user.id,
        orgId:              userData?.org_id ?? '',
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
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  return state
}

// ── Helper: get a scoped supabase client (RLS handles org filtering automatically)
export function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}