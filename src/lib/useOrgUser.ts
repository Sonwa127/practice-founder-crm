'use client'

import { useEffect, useState, useRef } from 'react'
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

// Module-level cache — survives re-renders, cleared on sign out
let cachedUser: OrgUser | null = null

const DEFAULT_STATE: OrgUser = {
  userId: '', orgId: '', employeeId: null, employeeName: null,
  email: null, role: null, isLoading: true,
  isAdmin: false, isMember: false, canViewAll: false,
}

export function useOrgUser(): OrgUser {
  const [state, setState] = useState<OrgUser>(
    cachedUser ? { ...cachedUser, isLoading: false } : DEFAULT_STATE
  )
  const loadingRef = useRef(false)  // prevents concurrent loads
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const load = async (userId?: string) => {
      // Skip if already loading or same user as last load
      if (loadingRef.current) return
      if (userId && userId === lastUserIdRef.current && cachedUser) {
        setState({ ...cachedUser, isLoading: false })
        return
      }

      loadingRef.current = true

      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          cachedUser = null
          lastUserIdRef.current = null
          setState({ ...DEFAULT_STATE, isLoading: false })
          loadingRef.current = false
          return
        }

        // Already loaded same user — use cache
        if (user.id === lastUserIdRef.current && cachedUser) {
          setState({ ...cachedUser, isLoading: false })
          loadingRef.current = false
          return
        }

        // Fetch role and employee in parallel
        const [userResult, employeeResult] = await Promise.allSettled([
          supabase.from('users').select('role').eq('id', user.id).single(),
          supabase.from('employees').select('id, org_id').eq('linked_user', user.id).single(),
        ])

        const role = userResult.status === 'fulfilled'
          ? (userResult.value.data?.role ?? null)
          : null

        let employee: { id: string; org_id: string } | null =
          employeeResult.status === 'fulfilled' ? employeeResult.value.data : null

        // Fallback: try email match if linked_user didn't find anything
        if (!employee && user.email) {
          const { data } = await supabase
            .from('employees').select('id, org_id')
            .eq('email', user.email).single()
          employee = data ?? null
        }

        const isAdmin    = role === 'admin'
        const isMember   = role === 'member'
        const canViewAll = isAdmin

        const next: OrgUser = {
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
        }

        cachedUser = next
        lastUserIdRef.current = user.id
        setState(next)

      } catch {
        setState(s => ({ ...s, isLoading: false }))
      } finally {
        loadingRef.current = false
      }
    }

    // Initial load
    load()

    // Only re-load on actual sign in/out — ignore token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        load(session?.user?.id)
      }
      if (event === 'SIGNED_OUT') {
        cachedUser = null
        lastUserIdRef.current = null
        setState({ ...DEFAULT_STATE, isLoading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}

export function useSupabase() {
  return supabase  // reuse the same instance instead of creating a new one
}