'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import {
  Search, Filter, ArrowUpDown, Download, RefreshCw,
  Plus, X, ChevronDown, ChevronUp, ChevronsUpDown,
  Check, Loader2, AlertCircle, Calendar, Clock,
  Users, AlertTriangle, FileText, CheckSquare, Square,
  LayoutGrid, SlidersHorizontal, Group, Upload
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowHeight = 'compact' | 'medium' | 'tall'
type SortConfig = { key: keyof Huddle; dir: 'asc' | 'desc' } | null

type Huddle = {
  id: string
  org_id: string
  date: string
  huddle_end_time: string | null
  present: string | null
  issues_assigned_today: string | null
  new_issues_raised_today: string | null
  all_issues_have_owners: boolean | null
  charts_not_closed_yesterday: number | null
  claims_not_submitted_yesterday: number | null
  huddle_complete: boolean | null
  notes_summary: string | null
  submitted_by: string | null
  created_at: string
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO: Huddle[] = [
  {
    id: 'dh-1', org_id: 'demo', date: '2025-04-29',
    huddle_end_time: '09:18', present: 'Dr. Evans, Markel, Michael, Receptionist',
    issues_assigned_today: 'Michael — resolve denied claims batch\nMarkel — follow up on MA coverage',
    new_issues_raised_today: 'Insurance verification backlog flagged',
    all_issues_have_owners: true,
    charts_not_closed_yesterday: 2, claims_not_submitted_yesterday: 3,
    huddle_complete: true,
    notes_summary: 'Short huddle. Two charts pending from yesterday — Dr. Evans to close by noon. Claims backlog being addressed by Michael.',
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'dh-2', org_id: 'demo', date: '2025-04-28',
    huddle_end_time: '09:22', present: 'Dr. Evans, Markel, Michael',
    issues_assigned_today: 'Markel — MA no-show coverage plan',
    new_issues_raised_today: 'MA no-show impacted 3 patient rooms',
    all_issues_have_owners: false,
    charts_not_closed_yesterday: 0, claims_not_submitted_yesterday: 1,
    huddle_complete: true,
    notes_summary: 'MA absence caused delays. Markel to source temp coverage. One claim still outstanding from Friday.',
    submitted_by: null, created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── New Huddle Modal ─────────────────────────────────────────────────────────
function NewHuddleModal({ orgId, onClose, onCreated }: {
  orgId: string; onClose: () => void; onCreated: () => void
}) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today, huddle_end_time: '', present: '',
    issues_assigned_today: '', new_issues_raised_today: '',
    all_issues_have_owners: false,
    charts_not_closed_yesterday: '', claims_not_submitted_yesterday: '',
    huddle_complete: false, notes_summary: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.date) { setErr('Date is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('daily_huddle_log').insert({
      org_id: orgId,
      date: form.date,
      huddle_end_time: form.huddle_end_time || null,
      present: form.present || null,
      issues_assigned_today: form.issues_assigned_today || null,
      new_issues_raised_today: form.new_issues_raised_today || null,
      all_issues_have_owners: form.all_issues_have_owners,
      charts_not_closed_yesterday: form.charts_not_closed_yesterday ? parseInt(form.charts_not_closed_yesterday as string) : null,
      claims_not_submitted_yesterday: form.claims_not_submitted_yesterday ? parseInt(form.claims_not_submitted_yesterday as string) : null,
      huddle_complete: form.huddle_complete,
      notes_summary: form.notes_summary || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
          <h2 className="text-[#c4b49a] font-semibold flex items-center gap-2">
            <Users size={15} className="text-[#c8843a]" />New Huddle Log
          </h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2">
              <AlertCircle size={13} />{err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Huddle End Time</label>
              <input type="time" value={form.huddle_end_time} onChange={e => set('huddle_end_time', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Present</label>
            <input value={form.present} onChange={e => set('present', e.target.value)}
              placeholder="Dr. Evans, Markel, Michael…"
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Charts Not Closed Yesterday</label>
              <input type="number" min="0" value={form.charts_not_closed_yesterday} onChange={e => set('charts_not_closed_yesterday', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Claims Not Submitted Yesterday</label>
              <input type="number" min="0" value={form.claims_not_submitted_yesterday} onChange={e => set('claims_not_submitted_yesterday', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Issues Assigned Today</label>
            <textarea value={form.issues_assigned_today} onChange={e => set('issues_assigned_today', e.target.value)}
              placeholder="One per line: Name — task…" rows={3}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">New Issues Raised Today</label>
            <textarea value={form.new_issues_raised_today} onChange={e => set('new_issues_raised_today', e.target.value)}
              placeholder="Issues that came up in today's huddle…" rows={2}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Notes / Summary</label>
            <textarea value={form.notes_summary} onChange={e => set('notes_summary', e.target.value)}
              placeholder="Brief summary of what was discussed and decided…" rows={3}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            {[
              { key: 'all_issues_have_owners', label: 'All issues have owners?' },
              { key: 'huddle_complete', label: 'Huddle complete?' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <button type="button"
                  onClick={() => set(key, !form[key as keyof typeof form])}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                    ${form[key as keyof typeof form] ? 'bg-[#c8843a] border-[#c8843a]' : 'border-[#2e2016] bg-[#120d08] group-hover:border-[#c8843a]/50'}`}>
                  {form[key as keyof typeof form] && <Check size={10} className="text-white" />}
                </button>
                <span className="text-[#a08060] text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Huddle
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function HuddlePage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { orgId, canViewAll } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)
  const canCreate = canViewAll

  const [search, setSearch]         = useState('')
  const [rowHeight, setRowHeight]   = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', dir: 'desc' })
  const [filterComplete, setFilterComplete] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Huddle | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [showFilters, setShowFilters]       = useState(false)

  const { data: huddles, isLoading, refetch } = useQuery<Huddle[]>({
    queryKey: ['huddle', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_huddle_log')
        .select('*')
        .eq('org_id', orgId!)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Huddle[]
    },
  })

  const rows  = huddles ?? (isLoading ? [] : DEMO)
  const isDemo = !huddles && !isLoading

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        (x.date ?? '').includes(q) ||
        (x.present ?? '').toLowerCase().includes(q) ||
        (x.notes_summary ?? '').toLowerCase().includes(q)
      )
    }
    if (filterComplete === 'yes') r = r.filter(x => x.huddle_complete === true)
    if (filterComplete === 'no')  r = r.filter(x => !x.huddle_complete)
    if (sortConfig) {
      const { key, dir } = sortConfig
      r = [...r].sort((a, b) => dir === 'asc'
        ? String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
        : String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
    }
    return r
  }, [rows, search, filterComplete, sortConfig])

  function toggleSort(key: keyof Huddle) {
    setSortConfig(prev => prev?.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: keyof Huddle }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  function BoolBadge({ val }: { val: boolean | null }) {
    if (val === null || val === undefined) return <span className="text-[#6b5a47]">—</span>
    return val
      ? <span className="inline-flex items-center gap-1 text-[#86efac]"><Check size={11} />Yes</span>
      : <span className="inline-flex items-center gap-1 text-[#f87171]"><X size={11} />No</span>
  }

  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'
  const total    = filtered.length
  const complete = filtered.filter(x => x.huddle_complete).length

  function exportCsv() {
    const headers = ['Date', 'End Time', 'Present', 'Complete', 'Charts Pending', 'Claims Pending', 'All Issues Have Owners']
    const csv = [headers, ...filtered.map(r => [
      r.date, r.huddle_end_time ?? '', r.present ?? '',
      r.huddle_complete ? 'Yes' : 'No',
      r.charts_not_closed_yesterday ?? 0,
      r.claims_not_submitted_yesterday ?? 0,
      r.all_issues_have_owners ? 'Yes' : 'No'
    ])].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv]))
    a.download = 'huddle-log.csv'; a.click()
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a]">Daily Huddle Log</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          {total} record{total !== 1 ? 's' : ''} &nbsp;·&nbsp;
          <span className="text-[#86efac]">{complete} complete</span>
          {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search huddles…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!filterComplete },
          { icon: <ArrowUpDown size={13} />, label: 'Sort' },
          { icon: <Group size={13} />, label: 'Group' },
          { icon: <Calendar size={13} />, label: 'Date' },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors
              ${btn.active ? 'bg-[#c8843a]/20 text-[#c8843a] border border-[#c8843a]/30' : 'text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] border border-transparent'}`}>
            {btn.icon}{btn.label}
          </button>
        ))}
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        <div className="flex rounded border border-[#2e2016] overflow-hidden">
          {(['compact', 'medium', 'tall'] as RowHeight[]).map(h => (
            <button key={h} onClick={() => setRowHeight(h)}
              className={`px-2 py-1.5 text-xs transition-colors ${rowHeight === h ? 'bg-[#2e2016] text-[#c8843a]' : 'text-[#6b5a47] hover:text-[#c4b49a]'}`}>
              {h === 'compact' ? '—' : h === 'medium' ? '≡' : '☰'}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><LayoutGrid size={13} />Views</button>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><Download size={13} />Export</button>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><Upload size={13} />Import</button>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><RefreshCw size={13} />Refresh</button>
        <div className="flex-1" />
        {canCreate && (
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8843a] hover:bg-[#d4924a] text-white text-xs font-medium rounded-lg transition-colors">
            <Plus size={13} />New Huddle
          </button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="px-4 py-2.5 border-b border-[#2e2016] bg-[#1e1409] flex items-center gap-3">
          <span className="text-[#6b5a47] text-xs font-medium">Filters:</span>
          <select value={filterComplete} onChange={e => setFilterComplete(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Records</option>
            <option value="yes">Complete Only</option>
            <option value="no">Incomplete Only</option>
          </select>
          {filterComplete && (
            <button onClick={() => setFilterComplete('')}
              className="flex items-center gap-1 text-xs text-[#f87171]"><X size={11} />Clear</button>
          )}
        </div>
      )}

      {/* Table + detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                <th className="pf-sticky-checkbox w-8 px-2 py-2">
                  <input type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                    className="accent-[#c8843a]" />
                </th>
                {[
                  { key: 'date' as keyof Huddle,                          label: 'Date',                       icon: <Calendar size={11} />, w: 'min-w-[160px]' },
                  { key: 'huddle_end_time' as keyof Huddle,               label: 'End Time',                   icon: <Clock size={11} />, w: 'min-w-[90px]' },
                  { key: 'huddle_complete' as keyof Huddle,               label: 'Complete?',                  icon: <CheckSquare size={11} />, w: 'min-w-[90px]' },
                  { key: 'present' as keyof Huddle,                       label: 'Present',                    icon: <Users size={11} />, w: 'min-w-[180px]' },
                  { key: 'charts_not_closed_yesterday' as keyof Huddle,   label: 'Charts Pending',             icon: <FileText size={11} />, w: 'min-w-[110px]' },
                  { key: 'claims_not_submitted_yesterday' as keyof Huddle,label: 'Claims Pending',             icon: <AlertTriangle size={11} />, w: 'min-w-[110px]' },
                  { key: 'all_issues_have_owners' as keyof Huddle,        label: 'All Issues Owned?',          icon: <Check size={11} />, w: 'min-w-[120px]' },
                  { key: 'new_issues_raised_today' as keyof Huddle,       label: 'New Issues Raised',          icon: <AlertTriangle size={11} />, w: 'min-w-[180px]' },
                  { key: 'notes_summary' as keyof Huddle,                 label: 'Notes',                      icon: <FileText size={11} />, w: 'min-w-[220px]' },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className={`${col.w} px-3 py-2 text-left font-medium text-[#a08060] cursor-pointer hover:text-[#c4b49a] select-none whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1">{col.icon}{col.label}<SortIcon col={col.key} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-16 text-[#6b5a47]">
                  <Loader2 size={20} className="animate-spin inline mr-2" />Loading huddle log…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-[#6b5a47]">No huddle records found.</td></tr>
              ) : filtered.map((row, idx) => {
                const selected = selectedIds.has(row.id)
                const isActive = detailRow?.id === row.id
                const hasWarning = (row.charts_not_closed_yesterday ?? 0) > 0 || (row.claims_not_submitted_yesterday ?? 0) > 0

                return (
                  <tr key={row.id}
                    onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors
                      ${selected ? 'pf-row-selected' : ''}
                      ${isActive ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'}
                      hover:bg-[#c8843a]/5`}>

                    <td className="pf-sticky-checkbox px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(row.id) : next.delete(row.id)
                          setSelectedIds(next)
                        }}
                        className="accent-[#c8843a]" />
                    </td>

                    <td className={`pf-sticky-cell px-3 ${rowPy} font-medium text-[#c4b49a]`} style={{ left: 32 }}>
                      <span className="flex items-center gap-1.5">
                        {hasWarning && <AlertTriangle size={11} className="text-[#fb923c] shrink-0" />}
                        {fmtDate(row.date)}
                      </span>
                    </td>
                    <td className={`px-3 ${rowPy} text-[#a08060]`}>{row.huddle_end_time ?? '—'}</td>
                    <td className={`px-3 ${rowPy}`}><BoolBadge val={row.huddle_complete} /></td>
                    <td className={`px-3 ${rowPy} text-[#a08060] max-w-[200px] truncate`}>{row.present ?? '—'}</td>
                    <td className={`px-3 ${rowPy} text-right tabular-nums ${(row.charts_not_closed_yesterday ?? 0) > 0 ? 'text-[#fb923c]' : 'text-[#6b5a47]'}`}>
                      {row.charts_not_closed_yesterday ?? 0}
                    </td>
                    <td className={`px-3 ${rowPy} text-right tabular-nums ${(row.claims_not_submitted_yesterday ?? 0) > 0 ? 'text-[#f87171]' : 'text-[#6b5a47]'}`}>
                      {row.claims_not_submitted_yesterday ?? 0}
                    </td>
                    <td className={`px-3 ${rowPy}`}><BoolBadge val={row.all_issues_have_owners} /></td>
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[200px] truncate`}>
                      {row.new_issues_raised_today ?? '—'}
                    </td>
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[240px] truncate`}>
                      {row.notes_summary ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] sticky bottom-0 text-[#6b5a47]">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060] font-medium">{filtered.length} records</td>
                  <td />
                  <td className="px-3 py-2"><span className="text-[#86efac] text-[10px]">{complete} complete</span></td>
                  <td colSpan={3} />
                  <td className="px-3 py-2 text-right tabular-nums text-[#fb923c]">
                    {filtered.reduce((s, r) => s + (r.charts_not_closed_yesterday ?? 0), 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#f87171]">
                    {filtered.reduce((s, r) => s + (r.claims_not_submitted_yesterday ?? 0), 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Detail panel */}
        {detailRow && (
          <div className="w-[380px] border-l border-[#2e2016] bg-[#1e1409] flex flex-col overflow-y-auto shrink-0">
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  {detailRow.huddle_complete
                    ? <span className="text-[10px] bg-[#0f2318] text-[#86efac] px-2 py-0.5 rounded-full">Complete</span>
                    : <span className="text-[10px] bg-[#1a1a0f] text-[#facc15] px-2 py-0.5 rounded-full">Incomplete</span>
                  }
                </div>
                <h3 className="text-[#c4b49a] font-semibold text-sm">{fmtDate(detailRow.date)}</h3>
                {detailRow.huddle_end_time && (
                  <p className="text-[#6b5a47] text-xs mt-0.5 flex items-center gap-1"><Clock size={10} />Ended {detailRow.huddle_end_time}</p>
                )}
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors shrink-0"><X size={16} /></button>
            </div>

            <div className="px-4 py-3 space-y-3 text-xs">
              {detailRow.present && (
                <div>
                  <p className="text-[#6b5a47] mb-1 flex items-center gap-1"><Users size={11} />Present</p>
                  <p className="text-[#a08060]">{detailRow.present}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg px-3 py-2 border ${(detailRow.charts_not_closed_yesterday ?? 0) > 0 ? 'border-[#fb923c]/30 bg-[#2e1a10]/40' : 'border-[#2e2016] bg-[#120d08]'}`}>
                  <p className="text-[#6b5a47] text-[10px] mb-0.5">Charts Not Closed</p>
                  <p className={`text-xl font-bold tabular-nums ${(detailRow.charts_not_closed_yesterday ?? 0) > 0 ? 'text-[#fb923c]' : 'text-[#6b5a47]'}`}>
                    {detailRow.charts_not_closed_yesterday ?? 0}
                  </p>
                </div>
                <div className={`rounded-lg px-3 py-2 border ${(detailRow.claims_not_submitted_yesterday ?? 0) > 0 ? 'border-[#f87171]/30 bg-[#2e1010]/40' : 'border-[#2e2016] bg-[#120d08]'}`}>
                  <p className="text-[#6b5a47] text-[10px] mb-0.5">Claims Not Submitted</p>
                  <p className={`text-xl font-bold tabular-nums ${(detailRow.claims_not_submitted_yesterday ?? 0) > 0 ? 'text-[#f87171]' : 'text-[#6b5a47]'}`}>
                    {detailRow.claims_not_submitted_yesterday ?? 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#6b5a47] flex items-center gap-1"><CheckSquare size={11} />All issues have owners?</span>
                {detailRow.all_issues_have_owners
                  ? <span className="text-[#86efac] flex items-center gap-1"><Check size={11} />Yes</span>
                  : <span className="text-[#f87171] flex items-center gap-1"><X size={11} />No</span>
                }
              </div>

              {detailRow.issues_assigned_today && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Issues Assigned Today</p>
                  <div className="space-y-1">
                    {detailRow.issues_assigned_today.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="text-[#a08060] flex items-start gap-1.5">
                        <span className="text-[#c8843a] mt-0.5 shrink-0">→</span>{line}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {detailRow.new_issues_raised_today && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium flex items-center gap-1">
                    <AlertTriangle size={11} className="text-[#fb923c]" />New Issues Raised
                  </p>
                  <p className="text-[#a08060] whitespace-pre-wrap">{detailRow.new_issues_raised_today}</p>
                </div>
              )}

              {detailRow.notes_summary && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Notes / Summary</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.notes_summary}</p>
                </div>
              )}
            </div>

            {orgId && (
              <div className="border-t border-[#2e2016] px-4 py-3">
                <RecordComments recordId={detailRow.id} tableName="daily_huddle_log" orgId={orgId} />
              </div>
            )}

            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto">
              <button onClick={() => setDetailRow(null)}
                className="w-full py-2 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016] hover:border-[#c8843a]/30 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewModal && orgId && (
        <NewHuddleModal orgId={orgId} onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['huddle', orgId] })} />
      )}

      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">
          Click row to open details
          {!canCreate && ' · View only — Dr. Evans creates huddle records'}
        </p>
      </div>
    </div>
  )
}