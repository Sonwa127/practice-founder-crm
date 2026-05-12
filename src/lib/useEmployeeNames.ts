import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Employee { id: string; name: string }

export function useEmployeeNames(orgId: string | null) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('employees')
      .select('id, name')
      .eq('org_id', orgId)
      .then(({ data }) => setEmployees((data as Employee[]) ?? []))
  }, [orgId])

  function resolveName(id: string | null | undefined): string {
    if (!id) return '—'
    return employees.find(e => e.id === id)?.name ?? '—'
  }

  return { employees, resolveName }
}