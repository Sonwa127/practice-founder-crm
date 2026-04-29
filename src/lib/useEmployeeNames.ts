import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// Cache lives at module level so it persists across re-renders and pages
const cache: Record<string, string> = {}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Fetch all employees for an org and cache their names ──────────────────────
export async function prefetchEmployees(orgId: string): Promise<void> {
  if (!orgId) return
  const { data } = await supabase
    .from('employees')
    .select('id, name')
    .eq('org_id', orgId)
  if (data) {
    data.forEach(e => { cache[e.id] = e.name })
  }
}

// ── Resolve a single ID to a name (sync, uses cache) ─────────────────────────
export function resolveName(idOrName: string | null | undefined): string {
  if (!idOrName) return '—'
  // Already a plain name (not a UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)
  if (!isUUID) return idOrName
  return cache[idOrName] ?? `Staff (${idOrName.slice(0, 6)}…)`
}

// ── React hook: loads employee names and returns a resolver function ──────────
export function useEmployeeNames(orgId: string) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!orgId) return
    prefetchEmployees(orgId).then(() => setReady(true))
  }, [orgId])

  return { resolveName, ready }
}