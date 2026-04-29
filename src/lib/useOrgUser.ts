import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export interface OrgUser {
  userId: string
  orgId: string
  employeeId: string | null
  employeeName: string | null
  email: string | null
  isLoading: boolean
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
    isLoading: true,
  })

  useEffect(() => {
    const load = async () => {
      // 1. Get logged-in user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState(s => ({ ...s, isLoading: false }))
        return
      }

      // 2. Get their org_id and employee record
      // Assumes your employees table has: id, org_id, name, email, user_id (auth user id)
      const { data: employee } = await supabase
        .from('employees')
        .select('id, org_id, name, email')
        .eq('email', user.email!)
        .single()

      setState({
        userId:       user.id,
        orgId:        employee?.org_id ?? '',
        employeeId:   employee?.id ?? null,
        employeeName: employee?.name ?? user.email ?? null,
        email:        user.email ?? null,
        isLoading:    false,
      })
    }

    load()

    // Listen for auth changes (logout/login)
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