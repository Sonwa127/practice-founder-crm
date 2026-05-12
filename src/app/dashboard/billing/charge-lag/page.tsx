'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface ChargeLagEntry {
  id: string
  org_id: string
  date: string
  submitted_by: string | null
  total_charts_closed: number | null
  claims_submitted_within_24h: number | null
  claims_submitted_24_to_48h: number | null
  claims_submitted_over_48h: number | null
  average_lag_hours: number | null
  notes: string | null
  created_at: string
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function lagColor(hours: number | null) {
  if (hours === null) return 'text-[#c4b49a]/50'
  if (hours < 24) return 'text-green-400'
  if (hours < 48) return 'text-amber-400'
  return 'text-red-400'
}

export default function ChargeLagPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'admin']}>
      <ChargeLagContent />
    </RoleGuard>
  )
}

function ChargeLagContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = {
    date: new Date().toISOString().slice(0, 10),
    submitted_by: employeeId ?? '',
    total_charts_closed: '',
    claims_submitted_within_24h: '',
    claims_submitted_24_to_48h: '',
    claims_submitted_over_48h: '',
    average_lag_hours: '',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['charge-lag', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_lag_submissions')
        .select('*')
        .eq('org_id', orgId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data as ChargeLagEntry[]
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['charge-lag', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('charge_lag_submissions').insert({
        org_id: orgId,
        date: p.date,
        submitted_by: p.submitted_by || null,
        total_charts_closed: p.total_charts_closed ? Number(p.total_charts_closed) : null,
        claims_submitted_within_24h: p.claims_submitted_within_24h ? Number(p.claims_submitted_within_24h) : null,
        claims_submitted_24_to_48h: p.claims_submitted_24_to_48h ? Number(p.claims_submitted_24_to_48h) : null,
        claims_submitted_over_48h: p.claims_submitted_over_48h ? Number(p.claims_submitted_over_48h) : null,
        average_lag_hours: p.average_lag_hours ? Number(p.average_lag_hours) : null,
        notes: p.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('charge_lag_submissions').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const allSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id))

  // Summary stats
  const avgLag = entries.length > 0
    ? entries.filter(e => e.average_lag_hours !== null).reduce((s, e) => s + (e.average_lag_hours ?? 0), 0) / entries.filter(e => e.average_lag_hours !== null).length
    : null
  const within24Total = entries.reduce((s, e) => s + (e.claims_submitted_within_24h ?? 0), 0)
  const over48Total = entries.reduce((s, e) => s + (e.claims_submitted_over_48h ?? 0), 0)
  const totalClaims = entries.reduce((s, e) => s + (e.claims_submitted_within_24h ?? 0) + (e.claims_submitted_24_to_48h ?? 0) + (e.claims_submitted_over_48h ?? 0), 0)

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Billing Activities</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Charge Lag (Internal)</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Track how quickly claims are submitted after chart close — target: under 24 hours</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }) }} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">
          + New Entry
        </button>
      </div>

      {/* Alert banner if average lag is over 48h */}
      {avgLag !== null && avgLag > 48 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-sm text-red-300">Average charge lag is <strong>{avgLag.toFixed(1)} hours</strong> — above the 48h alert threshold. Target is under 24 hours.</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Avg Lag</p>
          <p className={`text-2xl font-bold mt-1 ${lagColor(avgLag)}`}>{avgLag !== null ? `${avgLag.toFixed(1)}h` : '—'}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">Target: &lt;24h</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">&lt;24h Claims</p>
          <p className="text-2xl font-bold mt-1 text-green-400">{within24Total}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">{totalClaims > 0 ? `${Math.round(within24Total / totalClaims * 100)}% of total` : '—'}</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">&gt;48h Claims</p>
          <p className="text-2xl font-bold mt-1 text-red-400">{over48Total}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">{totalClaims > 0 ? `${Math.round(over48Total / totalClaims * 100)}% of total` : '—'}</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Records</p>
          <p className="text-2xl font-bold mt-1 text-[#c4b49a]">{entries.length}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">All time entries</p>
        </div>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <button onClick={() => setConfirmDelete([...selectedIds])} className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">
            Delete ({selectedIds.size})
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-[#c4b49a]/50 hover:text-[#c4b49a]">Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(entries.map(e => e.id))); else setSelectedIds(new Set()) }} className="w-4 h-4 accent-[#c8843a]" /></th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Date</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Submitted By</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Charts Closed</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">&lt;24h</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">24–48h</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">&gt;48h</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Avg Lag</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={9} className="p-12 text-center text-[#c4b49a]/40 text-sm">No charge lag entries yet. Add the first one.</td></tr>
            ) : entries.map(entry => (
              <>
                <tr key={entry.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === entry.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(entry.id) : n.delete(entry.id); setSelectedIds(n) }} className="w-4 h-4 accent-[#c8843a]" /></td>
                  <td className="p-3"><button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors"><svg className={`w-4 h-4 transition-transform ${expandedId === entry.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button></td>
                  <td className="p-3 text-[#c4b49a] font-medium">{fmt(entry.date)}</td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">{resolveName(entry.submitted_by)}</td>
                  <td className="p-3 text-right text-[#c4b49a]/80">{entry.total_charts_closed ?? '—'}</td>
                  <td className="p-3 text-right text-green-400 font-medium">{entry.claims_submitted_within_24h ?? '—'}</td>
                  <td className="p-3 text-right text-amber-400">{entry.claims_submitted_24_to_48h ?? '—'}</td>
                  <td className="p-3 text-right text-red-400 font-medium">{entry.claims_submitted_over_48h ?? '—'}</td>
                  <td className={`p-3 text-right font-semibold ${lagColor(entry.average_lag_hours)}`}>
                    {entry.average_lag_hours !== null ? `${entry.average_lag_hours}h` : '—'}
                  </td>
                </tr>
                {expandedId === entry.id && (
                  <tr key={`${entry.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={9} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: 'Date', value: fmt(entry.date) },
                              { label: 'Submitted By', value: resolveName(entry.submitted_by) },
                              { label: 'Charts Closed', value: entry.total_charts_closed },
                              { label: 'Claims < 24h', value: entry.claims_submitted_within_24h },
                              { label: 'Claims 24–48h', value: entry.claims_submitted_24_to_48h },
                              { label: 'Claims > 48h', value: entry.claims_submitted_over_48h },
                              { label: 'Avg Lag (hours)', value: entry.average_lag_hours },
                            ].map(f => (
                              <div key={f.label}>
                                <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                                <p className="text-sm text-[#c4b49a]">{f.value ?? '—'}</p>
                              </div>
                            ))}
                          </div>
                          {entry.notes && (
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Notes</p>
                              <p className="text-sm text-[#c4b49a]/80 leading-relaxed">{entry.notes}</p>
                            </div>
                          )}
                        </div>
                        <div><RecordComments orgId={orgId} recordId={entry.id} tableName="charge_lag_submissions" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([entry.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete entry</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#2e2016] bg-[#1a1410]">
                <td colSpan={4} className="p-3 text-xs text-[#c4b49a]/50 uppercase tracking-widest font-medium">Totals</td>
                <td className="p-3 text-right text-[#c4b49a] font-semibold">{entries.reduce((s, e) => s + (e.total_charts_closed ?? 0), 0)}</td>
                <td className="p-3 text-right text-green-400 font-semibold">{within24Total}</td>
                <td className="p-3 text-right text-amber-400 font-semibold">{entries.reduce((s, e) => s + (e.claims_submitted_24_to_48h ?? 0), 0)}</td>
                <td className="p-3 text-right text-red-400 font-semibold">{over48Total}</td>
                <td className="p-3 text-right">
                  <span className={`font-semibold ${lagColor(avgLag)}`}>{avgLag !== null ? `${avgLag.toFixed(1)}h avg` : '—'}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        {entries.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {entries.length} entries</div>}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New Charge Lag Entry</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
              </div>
              <div>
                <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Submitted By</label>
                <select value={form.submitted_by} onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total Charts Closed', key: 'total_charts_closed' },
                { label: 'Claims < 24 Hours', key: 'claims_submitted_within_24h' },
                { label: 'Claims 24–48 Hours', key: 'claims_submitted_24_to_48h' },
                { label: 'Claims > 48 Hours', key: 'claims_submitted_over_48h' },
                { label: 'Average Lag (hours)', key: 'average_lag_hours' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label>
                  <input type="number" min="0" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => { if (form.date) createMutation.mutate(form) }} disabled={!form.date || createMutation.isPending} className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {createMutation.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this entry' : `${confirmDelete.length} entries`}? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending} className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}