'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface ClaimsSummaryEntry {
  id: string
  org_id: string
  week_start: string
  week_end: string | null
  submitted_by: string | null
  total_claims_submitted: number | null
  total_claims_paid: number | null
  total_claims_denied: number | null
  total_claims_pending: number | null
  total_amount_billed: number | null
  total_amount_paid: number | null
  denial_rate: number | null
  top_denial_reasons: string[] | null
  notes: string | null
  created_at: string
}

const DENIAL_REASON_OPTIONS = [
  'Missing Info',
  'Insurance Issue',
  'Coding Issue',
  'Duplicate/Not Billable',
  'System Error',
]

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currency(n: number | null) {
  if (n === null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function denialColor(pct: number | null) {
  if (pct === null) return 'text-[#c4b49a]/50'
  if (pct < 5) return 'text-green-400'
  if (pct < 10) return 'text-amber-400'
  return 'text-red-400'
}

export default function ClaimsSummaryPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'admin']}>
      <ClaimsSummaryContent />
    </RoleGuard>
  )
}

function ClaimsSummaryContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  const [selectedDenialReasons, setSelectedDenialReasons] = useState<string[]>([])

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const emptyForm = {
    week_start: monday.toISOString().slice(0, 10),
    week_end: friday.toISOString().slice(0, 10),
    submitted_by: employeeId ?? '',
    total_claims_submitted: '',
    total_claims_paid: '',
    total_claims_denied: '',
    total_claims_pending: '',
    total_amount_billed: '',
    total_amount_paid: '',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['claims-summary', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_claims_summary')
        .select('*')
        .eq('org_id', orgId!)
        .order('week_start', { ascending: false })
      if (error) throw error
      return data as ClaimsSummaryEntry[]
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['claims-summary', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const submitted = p.total_claims_submitted ? Number(p.total_claims_submitted) : null
      const denied    = p.total_claims_denied    ? Number(p.total_claims_denied)    : null
      const denialRate = submitted && denied !== null ? Math.round((denied / submitted) * 100 * 10) / 10 : null
      const { error } = await supabase.from('weekly_claims_summary').insert({
        org_id: orgId,
        week_start: p.week_start,
        week_end: p.week_end || null,
        submitted_by: p.submitted_by || null,
        total_claims_submitted: submitted,
        total_claims_paid: p.total_claims_paid ? Number(p.total_claims_paid) : null,
        total_claims_denied: denied,
        total_claims_pending: p.total_claims_pending ? Number(p.total_claims_pending) : null,
        total_amount_billed: p.total_amount_billed ? Number(p.total_amount_billed) : null,
        total_amount_paid: p.total_amount_paid ? Number(p.total_amount_paid) : null,
        denial_rate: denialRate,
        top_denial_reasons: selectedDenialReasons.length > 0 ? selectedDenialReasons : null,
        notes: p.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }); setSelectedDenialReasons([]) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('weekly_claims_summary').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const allSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id))
  const avgDenialRate = entries.length > 0 && entries.some(e => e.denial_rate !== null)
    ? entries.filter(e => e.denial_rate !== null).reduce((s, e) => s + (e.denial_rate ?? 0), 0) / entries.filter(e => e.denial_rate !== null).length
    : null
  const totalBilled = entries.reduce((s, e) => s + (e.total_amount_billed ?? 0), 0)
  const totalPaid   = entries.reduce((s, e) => s + (e.total_amount_paid ?? 0), 0)

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Billing Activities</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Claims Summary (Internal)</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Weekly claims performance — submission rates, denial analysis, and collections</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }); setSelectedDenialReasons([]) }} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">
          + New Summary
        </button>
      </div>

      {/* Alert */}
      {avgDenialRate !== null && avgDenialRate > 10 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-sm text-red-300">Average denial rate is <strong>{avgDenialRate.toFixed(1)}%</strong> — above the 10% alert threshold. Target is under 5%.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Avg Denial Rate</p>
          <p className={`text-2xl font-bold mt-1 ${denialColor(avgDenialRate)}`}>{avgDenialRate !== null ? `${avgDenialRate.toFixed(1)}%` : '—'}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">Target: &lt;5%</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Total Billed</p>
          <p className="text-xl font-bold mt-1 text-[#c4b49a]">{currency(totalBilled)}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">All periods</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Total Paid</p>
          <p className="text-xl font-bold mt-1 text-green-400">{currency(totalPaid)}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">{totalBilled > 0 ? `${Math.round(totalPaid / totalBilled * 100)}% collection rate` : 'All periods'}</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Weeks on File</p>
          <p className="text-2xl font-bold mt-1 text-[#c4b49a]">{entries.length}</p>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <button onClick={() => setConfirmDelete([...selectedIds])} className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">Delete ({selectedIds.size})</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-[#c4b49a]/50 hover:text-[#c4b49a]">Clear selection</button>
        </div>
      )}

      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(entries.map(e => e.id))); else setSelectedIds(new Set()) }} className="w-4 h-4 accent-[#c8843a]" /></th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Week</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Submitted</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Paid</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Denied</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Denial %</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Billed</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Collected</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={9} className="p-12 text-center text-[#c4b49a]/40 text-sm">No claims summaries yet. Add the first one.</td></tr>
            ) : entries.map(entry => (
              <>
                <tr key={entry.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === entry.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(entry.id) : n.delete(entry.id); setSelectedIds(n) }} className="w-4 h-4 accent-[#c8843a]" /></td>
                  <td className="p-3"><button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors"><svg className={`w-4 h-4 transition-transform ${expandedId === entry.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button></td>
                  <td className="p-3">
                    <p className="text-[#c4b49a] font-medium text-sm">{fmt(entry.week_start)}</p>
                    {entry.week_end && <p className="text-[#c4b49a]/40 text-xs">to {fmt(entry.week_end)}</p>}
                  </td>
                  <td className="p-3 text-right text-[#c4b49a]">{entry.total_claims_submitted ?? '—'}</td>
                  <td className="p-3 text-right text-green-400">{entry.total_claims_paid ?? '—'}</td>
                  <td className="p-3 text-right text-red-400">{entry.total_claims_denied ?? '—'}</td>
                  <td className={`p-3 text-right font-bold ${denialColor(entry.denial_rate)}`}>{entry.denial_rate !== null ? `${entry.denial_rate}%` : '—'}</td>
                  <td className="p-3 text-right text-[#c4b49a]/80">{currency(entry.total_amount_billed)}</td>
                  <td className="p-3 text-right text-green-400 font-medium">{currency(entry.total_amount_paid)}</td>
                </tr>
                {expandedId === entry.id && (
                  <tr key={`${entry.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={9} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Pending Claims</p><p className="text-sm text-[#c4b49a]">{entry.total_claims_pending ?? '—'}</p></div>
                            <div><p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Submitted By</p><p className="text-sm text-[#c4b49a]">{resolveName(entry.submitted_by)}</p></div>
                          </div>
                          {entry.top_denial_reasons && entry.top_denial_reasons.length > 0 && (
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-2">Top Denial Reasons</p>
                              <div className="flex flex-wrap gap-2">
                                {entry.top_denial_reasons.map(r => (
                                  <span key={r} className="px-2 py-1 bg-red-900/20 border border-red-700/30 text-red-300 text-xs rounded-full">{r}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {entry.notes && (
                            <div><p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-[#c4b49a]/80">{entry.notes}</p></div>
                          )}
                        </div>
                        <div><RecordComments orgId={orgId} recordId={entry.id} tableName="weekly_claims_summary" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([entry.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete summary</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {entries.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {entries.length} weekly summaries</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New Claims Summary</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Week Start *</label><input type="date" value={form.week_start} onChange={e => setForm(p => ({ ...p, week_start: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
              <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Week End</label><input type="date" value={form.week_end} onChange={e => setForm(p => ({ ...p, week_end: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Submitted By</label><select value={form.submitted_by} onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"><option value="">— Select —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Claims Submitted', key: 'total_claims_submitted' },
                { label: 'Claims Paid', key: 'total_claims_paid' },
                { label: 'Claims Denied', key: 'total_claims_denied' },
                { label: 'Claims Pending', key: 'total_claims_pending' },
                { label: 'Total Billed ($)', key: 'total_amount_billed' },
                { label: 'Total Paid ($)', key: 'total_amount_paid' },
              ].map(f => (
                <div key={f.key}><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label><input type="number" min="0" step={f.key.includes('amount') ? '0.01' : '1'} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
              ))}
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-2">Top Denial Reasons</label>
              <div className="flex flex-wrap gap-2">
                {DENIAL_REASON_OPTIONS.map(r => (
                  <button key={r} type="button" onClick={() => setSelectedDenialReasons(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedDenialReasons.includes(r) ? 'bg-[#c8843a]/20 border-[#c8843a] text-[#c8843a]' : 'bg-transparent border-[#2e2016] text-[#c4b49a]/50 hover:border-[#c8843a]/40 hover:text-[#c4b49a]'}`}>{r}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" /></div>
            <p className="text-xs text-[#c4b49a]/40 italic">Denial rate is auto-calculated from submitted / denied counts.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => { if (form.week_start) createMutation.mutate(form) }} disabled={!form.week_start || createMutation.isPending} className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">{createMutation.isPending ? 'Saving…' : 'Save Summary'}</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this summary' : `${confirmDelete.length} summaries`}? This cannot be undone.</p>
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