'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface ARReportEntry {
  id: string
  practice_id: string
  report_date: string
  submitted_by: string | null
  total_ar_balance: number | null
  ar_0_30_days: number | null
  ar_31_60_days: number | null
  ar_61_90_days: number | null
  ar_over_90_days: number | null
  ar_over_90_pct: number | null
  notes: string | null
  created_at: string
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currency(n: number | null) {
  if (n === null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pctColor(pct: number | null) {
  if (pct === null) return 'text-[#c4b49a]/50'
  if (pct < 5) return 'text-green-400'
  if (pct < 10) return 'text-amber-400'
  return 'text-red-400'
}

export default function ARReportPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'admin']}>
      <ARReportContent />
    </RoleGuard>
  )
}

function ARReportContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = {
    report_date: new Date().toISOString().slice(0, 10),
    submitted_by: employeeId ?? '',
    total_ar_balance: '',
    ar_0_30_days: '',
    ar_31_60_days: '',
    ar_61_90_days: '',
    ar_over_90_days: '',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ar-report', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_report_submissions')
        .select('*')
        .eq('practice_id', orgId!)
        .order('report_date', { ascending: false })
      if (error) throw error
      return data as ARReportEntry[]
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ar-report', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const over90 = p.ar_over_90_days ? Number(p.ar_over_90_days) : null
      const total  = p.total_ar_balance ? Number(p.total_ar_balance) : null
      const pct    = over90 !== null && total && total > 0 ? Math.round((over90 / total) * 100 * 10) / 10 : null
      const { error } = await supabase.from('ar_report_submissions').insert({
        practice_id: orgId,
        report_date: p.report_date,
        submitted_by: p.submitted_by || null,
        total_ar_balance: total,
        ar_0_30_days: p.ar_0_30_days ? Number(p.ar_0_30_days) : null,
        ar_31_60_days: p.ar_31_60_days ? Number(p.ar_31_60_days) : null,
        ar_61_90_days: p.ar_61_90_days ? Number(p.ar_61_90_days) : null,
        ar_over_90_days: over90,
        ar_over_90_pct: pct,
        notes: p.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('ar_report_submissions').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const allSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id))
  const latestEntry  = entries[0] ?? null
  const avgOver90Pct = entries.length > 0
    ? entries.filter(e => e.ar_over_90_pct !== null).reduce((s, e) => s + (e.ar_over_90_pct ?? 0), 0) / entries.filter(e => e.ar_over_90_pct !== null).length
    : null

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Billing Activities</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">AR Report (Internal)</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Accounts receivable aging — track AR buckets and 90+ day exposure. Target: AR 90+ &lt;5%</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }) }} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">
          + New Report
        </button>
      </div>

      {/* Alert if latest 90+ pct is over threshold */}
      {latestEntry?.ar_over_90_pct !== null && latestEntry && (latestEntry.ar_over_90_pct ?? 0) > 10 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-sm text-red-300">Latest AR 90+ days is <strong>{latestEntry.ar_over_90_pct}%</strong> — above the 10% alert threshold. Target is under 5%.</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Latest AR Balance</p>
          <p className="text-xl font-bold mt-1 text-[#c4b49a]">{currency(latestEntry?.total_ar_balance ?? null)}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">{latestEntry ? fmt(latestEntry.report_date) : 'No data'}</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Latest 90+ Days</p>
          <p className={`text-xl font-bold mt-1 ${pctColor(latestEntry?.ar_over_90_pct ?? null)}`}>{latestEntry?.ar_over_90_pct !== null && latestEntry ? `${latestEntry.ar_over_90_pct}%` : '—'}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">Target: &lt;5%</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Avg 90+ Days</p>
          <p className={`text-xl font-bold mt-1 ${pctColor(avgOver90Pct)}`}>{avgOver90Pct !== null ? `${avgOver90Pct.toFixed(1)}%` : '—'}</p>
          <p className="text-xs text-[#c4b49a]/40 mt-1">All-time average</p>
        </div>
        <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">Reports Filed</p>
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
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Date</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Submitted By</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Total AR</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">0–30d</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">31–60d</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">61–90d</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">90+ days</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">90+ %</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={10} className="p-12 text-center text-[#c4b49a]/40 text-sm">No AR reports yet. Add the first one.</td></tr>
            ) : entries.map(entry => (
              <>
                <tr key={entry.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === entry.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(entry.id) : n.delete(entry.id); setSelectedIds(n) }} className="w-4 h-4 accent-[#c8843a]" /></td>
                  <td className="p-3"><button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors"><svg className={`w-4 h-4 transition-transform ${expandedId === entry.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button></td>
                  <td className="p-3 text-[#c4b49a] font-medium">{fmt(entry.report_date)}</td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">{resolveName(entry.submitted_by)}</td>
                  <td className="p-3 text-right text-[#c4b49a] font-medium">{currency(entry.total_ar_balance)}</td>
                  <td className="p-3 text-right text-[#c4b49a]/70">{currency(entry.ar_0_30_days)}</td>
                  <td className="p-3 text-right text-amber-400/80">{currency(entry.ar_31_60_days)}</td>
                  <td className="p-3 text-right text-amber-400">{currency(entry.ar_61_90_days)}</td>
                  <td className="p-3 text-right text-red-400 font-medium">{currency(entry.ar_over_90_days)}</td>
                  <td className={`p-3 text-right font-bold ${pctColor(entry.ar_over_90_pct)}`}>{entry.ar_over_90_pct !== null ? `${entry.ar_over_90_pct}%` : '—'}</td>
                </tr>
                {expandedId === entry.id && (
                  <tr key={`${entry.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={10} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          {/* AR aging bar visual */}
                          {entry.total_ar_balance && entry.total_ar_balance > 0 && (
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-2">AR Aging Breakdown</p>
                              <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
                                {[
                                  { val: entry.ar_0_30_days, color: 'bg-green-600', label: '0–30d' },
                                  { val: entry.ar_31_60_days, color: 'bg-amber-500', label: '31–60d' },
                                  { val: entry.ar_61_90_days, color: 'bg-orange-500', label: '61–90d' },
                                  { val: entry.ar_over_90_days, color: 'bg-red-600', label: '90+d' },
                                ].map(b => {
                                  const pct = b.val ? Math.round((b.val / entry.total_ar_balance!) * 100) : 0
                                  return pct > 0 ? <div key={b.label} className={`${b.color} flex items-center justify-center text-[10px] font-bold text-white`} style={{ width: `${pct}%` }}>{pct > 8 ? `${pct}%` : ''}</div> : null
                                })}
                              </div>
                              <div className="flex gap-4 mt-2">
                                {[
                                  { color: 'bg-green-600', label: '0–30d' },
                                  { color: 'bg-amber-500', label: '31–60d' },
                                  { color: 'bg-orange-500', label: '61–90d' },
                                  { color: 'bg-red-600', label: '90+d' },
                                ].map(l => <div key={l.label} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} /><span className="text-xs text-[#c4b49a]/50">{l.label}</span></div>)}
                              </div>
                            </div>
                          )}
                          {entry.notes && (
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Notes</p>
                              <p className="text-sm text-[#c4b49a]/80">{entry.notes}</p>
                            </div>
                          )}
                        </div>
                        <div><RecordComments orgId={orgId} recordId={entry.id} tableName="ar_report_submissions" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([entry.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete report</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {entries.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {entries.length} reports</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New AR Report</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Report Date *</label><input type="date" value={form.report_date} onChange={e => setForm(p => ({ ...p, report_date: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
              <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Submitted By</label><select value={form.submitted_by} onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"><option value="">— Select —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            </div>
            <p className="text-xs text-[#c4b49a]/40 italic">Enter dollar amounts. The 90+ % will be auto-calculated from your entries.</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total AR Balance ($)', key: 'total_ar_balance' },
                { label: 'AR 0–30 Days ($)', key: 'ar_0_30_days' },
                { label: 'AR 31–60 Days ($)', key: 'ar_31_60_days' },
                { label: 'AR 61–90 Days ($)', key: 'ar_61_90_days' },
                { label: 'AR 90+ Days ($)', key: 'ar_over_90_days' },
              ].map(f => (
                <div key={f.key}><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label><input type="number" min="0" step="0.01" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
              ))}
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => { if (form.report_date) createMutation.mutate(form) }} disabled={!form.report_date || createMutation.isPending} className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">{createMutation.isPending ? 'Saving…' : 'Save Report'}</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this report' : `${confirmDelete.length} reports`}? This cannot be undone.</p>
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