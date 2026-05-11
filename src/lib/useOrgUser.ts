import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Export so pages can import the type
export type Role = 'pf_admin' | 'pf_team' | 'client_owner' | 'client_staff'

interface OrgUser {
  userId: string | null
  orgId: string | null
  employeeId: string | null
  employeeName: string | null
  role: Role | null
  isPfAdmin: boolean
  isPfTeam: boolean
  isClientOwner: boolean
  isClientStaff: boolean
  canViewAll: boolean
  isLoading: boolean
}

export function useOrgUser(): OrgUser {
  const supabase = createClient()
  const [state, setState] = useState<OrgUser>({
    userId: null,
    orgId: null,
    employeeId: null,
    employeeName: null,
    role: null,
    isPfAdmin: false,
    isPfTeam: false,
    isClientOwner: false,
    isClientStaff: false,
    canViewAll: false,
    isLoading: true,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState(s => ({ ...s, isLoading: false }))
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('practice_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setState(s => ({ ...s, userId: user.id, isLoading: false }))
        return
      }

      // Map legacy role strings to new system
      let role = profile.role as Role
      if ((profile.role as string) === 'admin') role = 'pf_admin' as Role
      if ((profile.role as string) === 'member') role = 'client_staff' as Role

      let employeeId: string | null = null
      let employeeName: string | null = null
      if (profile.practice_id) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, name')
          .eq('practice_id', profile.practice_id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (emp) {
          employeeId = emp.id
          employeeName = emp.name
        }
      }

      setState({
        userId: user.id,
        orgId: profile.practice_id ?? null,
        employeeId,
        employeeName,
        role,
        isPfAdmin: role === 'pf_admin',
        isPfTeam: role === 'pf_admin' || role === 'pf_team',
        isClientOwner: role === 'client_owner',
        isClientStaff: role === 'client_staff',
        canViewAll: role === 'pf_admin' || role === 'pf_team',
        isLoading: false,
      })
    }

    load()
  }, [])

  return state
}