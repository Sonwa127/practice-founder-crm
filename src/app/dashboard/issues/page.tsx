'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import {
  Search, SlidersHorizontal, Filter, ArrowUpDown, Group,
  Calendar, Download, Upload, RefreshCw, Plus, X,
  ChevronDown, ChevronUp, ChevronsUpDown,
  Check, Loader2, AlertCircle, User, Flag,
  Briefcase, Link2, LayoutGrid, AlertTriangle,
  ShieldAlert, Activity
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowHeight = 'compact' | 'medium' | 'tall'
type SortConfig = { key: keyof Issue; dir: 'asc' | 'desc' } | null

type Issue = {
  id: string
  org_id: string
  issue_name: string
  submitted_by: string | null   // employees.id (set by trigger)
  function: string | null
  impact_level: string | null
  status: string
  priority: string | null
  description: string | null
  root_cause: string | null
  link_to_huddle: string | null
  linked_task: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS  = ['Open', 'Investigating', 'Resolved', 'Closed']
const IMPACT_OPTIONS  = ['Low', 'Medium', 'High', 'Critical']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']

const FUNCTION_OPTIONS = [
  'Clinical Care', 'Patient Services', 'Patient Access & Front Desk',
  'Revenue Cycle & Finance', 'Operations', 'Marketing',
  'Human Resources & Staffing', 'Compliance', 'Leadership',
  'Legal & Risk', 'IT & Infrastructure',
  'Leadership & Strategic Growth', 'Quality Improvement & Maintenance'
]

const STATUS_COLORS: Record<string, string> = {
  'Open':          'bg-[#2e1010] text-[#f87171]',
  'Investigating': 'bg-[#1a1a0f] text-[#facc15]',
  'Resolved':      'bg-[#0f2318] text-[#86efac]',
  'Closed':        'bg-[#1e1409] text-[#6b5a47]',
}

const IMPACT_COLORS: Record<string, string> = {
  'Low':      'bg-[#1e1409] text-[#6b5a47]',
  'Medium':   'bg-[#1a1a0f] text-[#facc15]',
  'High':     'bg-[#2e1a10] text-[#fb923c]',
  'Critical': 'bg-[#2e1010] text-[#f87171]',
}

const PRIORITY_COLORS: Record<string, string> = {
  'Low':    'text-[#6b5a47]',
  'Medium': 'text-[#facc15]',
  'High':   'text-[#f87171]',
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO: Issue[] = [
  {
    id: 'di-1', org_id: 'demo', issue_name: 'Claims not submitted within 24hrs',
    submitted_by: null, function: 'Revenue Cycle & Finance',
    impact_level: 'High', status: 'Investigating', priority: 'High',
    description: 'Several claims from Monday were not submitted within the required 24-hour window after chart close.',
    root_cause: 'Billing staff did not receive chart closure notification from Cerbo.',
    link_to_huddle: null, linked_task: null, created_at: new Date().toISOString(),
  },
  {
    id: 'di-2', org_id: 'demo', issue_name: 'MA no-show — front desk coverage gap',
    submitted_by: null, function: 'Human Resources & Staffing',
    impact_level: 'Critical', status: 'Open', priority: 'High',
    description: 'MA called out with no backup available. Dr. Evans had to room patients herself.',
    root_cause: null,
    link_to_huddle: null, linked_task: null, created_at: new Date().toISOString(),
  },
  {
    id: 'di-3', org_id: 'demo', issue_name: 'Insurance verification backlog',
    submitted_by: null, function: 'Patient Access & Front Desk',
    impact_level: 'Medium', status: 'Open', priority: 'Medium',
    description: 'Upcoming week\'s patients have not had insurance verified. Three days behind.',
    root_cause: null,
    link_to_huddle: null, linked_task: null, created_at: new Date().toISOString(),
  },
  {
    id: 'di-4', org_id: 'demo', issue_name: 'Duplicate billing code on AWV claims',
    submitted_by: null, function: 'Revenue Cycle & Finance',
    impact_level: 'Medium', status: 'Resolved', priority: 'Medium',
    description: 'AWV claims were going out with a duplicate wellness code causing automatic denials.',
    root_cause: 'Template misconfigured in OPM after system update.',
    link_to_huddle: null, linked_task: null, created_at: new Date().toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Cell editors ─────────────────────────────────────────────────────────────
function SelectCell({ value, options, onSave, onCancel }: {
  value: string; options: string[]; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <select autoFocus defaultValue={value}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => e.key === 'Escape' && onCancel()}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function TextCell({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <input autoFocus defaultValue={value}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none" />
  )
}

// ─── New Issue Modal ──────────────────────────────────────────────────────────
function NewIssueModal({ orgId, onClose, onCreated }: {
  orgId: string; onClose: () => void; onCreated: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    issue_name: '', status: 'Open', function: '',
    impact_level: 'Medium', priority: 'Medium',
    description: '', root_cause: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.issue_name.trim()) { setErr('Issue name is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('issues_breakdowns').insert({
      org_id: orgId,
      issue_name: form.issue_name.trim(),
      status: form.status,
      function: form.function || null,
      impact_level: form.impact_level || null,
      priority: form.priority || null,
      description: form.description || null,
      root_cause: form.root_cause || null,
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
            <AlertTriangle size={15} className="text-[#fb923c]" />Log New Issue
          </h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2">
              <AlertCircle size={13} />{err}
            </div>
          )}
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Issue Name *</label>
            <input value={form.issue_name} onChange={e => set('issue_name', e.target.value)}
              placeholder="Short description of what went wrong…"
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none transition-colors" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Impact</label>
              <select value={form.impact_level} onChange={e => set('impact_level', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                {IMPACT_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                {PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Function</label>
            <select value={form.function} onChange={e => set('function', e.target.value)}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
              <option value="">— Select —</option>
              {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Full description of the issue…" rows={3}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Root Cause <span className="text-[#6b5a47]">(optional — fill after investigation)</span></label>
            <textarea value={form.root_cause} onChange={e => set('root_cause', e.target.value)}
              placeholder="What caused this?" rows={2}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Log Issue
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function IssuesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { orgId } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)

  const [search, setSearch]         = useState('')
  const [rowHeight, setRowHeight]   = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'status', dir: 'asc' })
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterImpact, setFilterImpact]     = useState('')
  const [filterFunction, setFilterFunction] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Issue | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [editCell, setEditCell] = useState<{ id: string; key: keyof Issue } | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: issues, isLoading, refetch } = useQuery<Issue[]>({
    queryKey: ['issues', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues_breakdowns')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Issue[]
    },
  })

  const rows = issues ?? (isLoading ? [] : DEMO)
  const isDemo = !issues && !isLoading

  const patchMutation = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: keyof Issue; value: unknown }) => {
      if (isDemo) return
      const { error } = await supabase.from('issues_breakdowns').update({ [key]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issues', orgId] }),
  })

  const saveCell = useCallback((id: string, key: keyof Issue, value: unknown) => {
    patchMutation.mutate({ id, key, value })
    setEditCell(null)
    setDetailRow(prev => prev?.id === id ? { ...prev, [key]: value } as Issue : prev)
  }, [patchMutation])

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.issue_name.toLowerCase().includes(q) ||
        (x.function ?? '').toLowerCase().includes(q) ||
        (x.status ?? '').toLowerCase().includes(q)
      )
    }
    if (filterStatus)   r = r.filter(x => x.status === filterStatus)
    if (filterImpact)   r = r.filter(x => x.impact_level === filterImpact)
    if (filterFunction) r = r.filter(x => x.function === filterFunction)
    if (sortConfig) {
      const { key, dir } = sortConfig
      r = [...r].sort((a, b) => dir === 'asc'
        ? String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
        : String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
    }
    return r
  }, [rows, search, filterStatus, filterImpact, filterFunction, sortConfig])

  const total      = filtered.length
  const open       = filtered.filter(x => x.status === 'Open').length
  const critical   = filtered.filter(x => x.impact_level === 'Critical').length
  const resolved   = filtered.filter(x => x.status === 'Resolved' || x.status === 'Closed').length

  function toggleSort(key: keyof Issue) {
    setSortConfig(prev => prev?.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: keyof Issue }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'

  function exportCsv() {
    const headers = ['Issue', 'Status', 'Impact', 'Priority', 'Function', 'Submitted By', 'Date']
    const csv2 = [headers, ...filtered.map(r => [
      r.issue_name, r.status, r.impact_level ?? '', r.priority ?? '',
      r.function ?? '', r.submitted_by ? resolveName(r.submitted_by) : '', fmtDate(r.created_at)
    ])].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv2]))
    a.download = 'issues.csv'; a.click()
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a]">Issues &amp; Breakdowns</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          {total} issue{total !== 1 ? 's' : ''} &nbsp;·&nbsp;
          <span className="text-[#f87171]">{open} open</span>
          {critical > 0 && <> &nbsp;·&nbsp; <span className="text-[#f87171] font-semibold">{critical} critical</span></>}
          &nbsp;·&nbsp;
          <span className="text-[#86efac]">{resolved} resolved/closed</span>
          {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!(filterStatus || filterImpact || filterFunction) },
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
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8843a] hover:bg-[#d4924a] text-white text-xs font-medium rounded-lg transition-colors">
          <Plus size={13} />Log Issue
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="px-4 py-2.5 border-b border-[#2e2016] bg-[#1e1409] flex items-center gap-3 flex-wrap">
          <span className="text-[#6b5a47] text-xs font-medium">Filters:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterImpact} onChange={e => setFilterImpact(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Impact Levels</option>
            {IMPACT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterFunction} onChange={e => setFilterFunction(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Functions</option>
            {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          {(filterStatus || filterImpact || filterFunction) && (
            <button onClick={() => { setFilterStatus(''); setFilterImpact(''); setFilterFunction('') }}
              className="flex items-center gap-1 text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors">
              <X size={11} />Clear
            </button>
          )}
        </div>
      )}

      {/* Table + detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[860px]">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                <th className="pf-sticky-checkbox w-8 px-2 py-2">
                  <input type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                    className="accent-[#c8843a]" />
                </th>
                {[
                  { key: 'issue_name' as keyof Issue,    label: 'Issue',           icon: <AlertTriangle size={11} />, w: 'min-w-[240px]' },
                  { key: 'status' as keyof Issue,        label: 'Status',          icon: <Activity size={11} />, w: 'min-w-[120px]' },
                  { key: 'impact_level' as keyof Issue,  label: 'Impact',          icon: <ShieldAlert size={11} />, w: 'min-w-[100px]' },
                  { key: 'priority' as keyof Issue,      label: 'Priority',        icon: <Flag size={11} />, w: 'min-w-[90px]' },
                  { key: 'function' as keyof Issue,      label: 'Function',        icon: <Briefcase size={11} />, w: 'min-w-[160px]' },
                  { key: 'submitted_by' as keyof Issue,  label: 'Submitted By',    icon: <User size={11} />, w: 'min-w-[130px]' },
                  { key: 'description' as keyof Issue,   label: 'Description',     icon: <Link2 size={11} />, w: 'min-w-[220px]' },
                  { key: 'root_cause' as keyof Issue,    label: 'Root Cause',      icon: <Link2 size={11} />, w: 'min-w-[180px]' },
                  { key: 'created_at' as keyof Issue,    label: 'Logged',          icon: <Calendar size={11} />, w: 'min-w-[110px]' },
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
                  <Loader2 size={20} className="animate-spin inline mr-2" />Loading issues…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-[#6b5a47]">No issues found.</td></tr>
              ) : filtered.map((row, idx) => {
                const selected = selectedIds.has(row.id)
                const isActive = detailRow?.id === row.id
                const isCritical = row.impact_level === 'Critical'

                return (
                  <tr key={row.id}
                    onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors group
                      ${selected ? 'pf-row-selected' : ''}
                      ${isActive ? 'bg-[#c8843a]/10' : isCritical ? 'bg-[#2e1010]/30' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'}
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

                    {/* Issue Name */}
                    <td className={`pf-sticky-cell px-3 ${rowPy} font-medium text-[#c4b49a]`} style={{ left: 32 }}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'issue_name' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'issue_name' ? (
                        <TextCell value={row.issue_name}
                          onSave={v => saveCell(row.id, 'issue_name', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {isCritical && <AlertTriangle size={11} className="text-[#f87171] shrink-0" />}
                          {row.issue_name}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className={`px-3 ${rowPy}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'status' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'status' ? (
                        <SelectCell value={row.status} options={STATUS_OPTIONS}
                          onSave={v => saveCell(row.id, 'status', v)} onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status] ?? ''}`}>
                          {row.status}
                        </span>
                      )}
                    </td>

                    {/* Impact */}
                    <td className={`px-3 ${rowPy}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'impact_level' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'impact_level' ? (
                        <SelectCell value={row.impact_level ?? ''} options={IMPACT_OPTIONS}
                          onSave={v => saveCell(row.id, 'impact_level', v)} onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPACT_COLORS[row.impact_level ?? ''] ?? 'bg-[#1e1409] text-[#6b5a47]'}`}>
                          {row.impact_level ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className={`px-3 ${rowPy}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'priority' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'priority' ? (
                        <SelectCell value={row.priority ?? ''} options={PRIORITY_OPTIONS}
                          onSave={v => saveCell(row.id, 'priority', v)} onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`text-xs font-medium ${PRIORITY_COLORS[row.priority ?? ''] ?? 'text-[#6b5a47]'}`}>
                          {row.priority ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Function */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'function' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'function' ? (
                        <SelectCell value={row.function ?? ''} options={FUNCTION_OPTIONS}
                          onSave={v => saveCell(row.id, 'function', v)} onCancel={() => setEditCell(null)} />
                      ) : (row.function ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>

                    {/* Submitted By */}
                    <td className={`px-3 ${rowPy} text-[#a08060]`}>
                      {row.submitted_by ? resolveName(row.submitted_by) : <span className="text-[#6b5a47]">—</span>}
                    </td>

                    {/* Description preview */}
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[220px]`}>
                      {row.description
                        ? <span className="truncate block">{row.description}</span>
                        : '—'}
                    </td>

                    {/* Root Cause preview */}
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[180px]`}>
                      {row.root_cause
                        ? <span className="truncate block">{row.root_cause}</span>
                        : <span className="text-[#2e2016] italic">Not identified</span>}
                    </td>

                    {/* Logged date */}
                    <td className={`px-3 ${rowPy} text-[#6b5a47] whitespace-nowrap`}>
                      {fmtDate(row.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] text-[#6b5a47] sticky bottom-0">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060] font-medium">{filtered.length} issues</td>
                  <td className="px-3 py-2"><span className="text-[#f87171] text-[10px]">{open} open</span></td>
                  <td className="px-3 py-2">
                    {critical > 0 && <span className="text-[#f87171] text-[10px] font-semibold">{critical} critical</span>}
                  </td>
                  <td className="px-3 py-2"><span className="text-[#86efac] text-[10px]">{resolved} resolved</span></td>
                  <td colSpan={5} />
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
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[detailRow.status] ?? ''}`}>
                    {detailRow.status}
                  </span>
                  {detailRow.impact_level && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPACT_COLORS[detailRow.impact_level]}`}>
                      {detailRow.impact_level} Impact
                    </span>
                  )}
                </div>
                <h3 className="text-[#c4b49a] font-semibold text-sm leading-snug">{detailRow.issue_name}</h3>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors mt-0.5 shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Flag size={11} />Priority</p>
                  <p className={`font-medium ${PRIORITY_COLORS[detailRow.priority ?? ''] ?? 'text-[#6b5a47]'}`}>{detailRow.priority ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><User size={11} />Submitted By</p>
                  <p className="text-[#c4b49a]">
                    {detailRow.submitted_by ? resolveName(detailRow.submitted_by) : <span className="text-[#6b5a47]">—</span>}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Function</p>
                  <p className="text-[#a08060]">{detailRow.function ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />Logged</p>
                  <p className="text-[#a08060]">{fmtDate(detailRow.created_at)}</p>
                </div>
              </div>

              {(detailRow.linked_task || detailRow.link_to_huddle) && (
                <div className="border-t border-[#2e2016] pt-3 space-y-1.5">
                  <p className="text-[#6b5a47] font-medium flex items-center gap-1"><Link2 size={11} />Linked Records</p>
                  {detailRow.linked_task && (
                    <p className="text-[#a08060]">Task: <span className="text-[#c4b49a]">{detailRow.linked_task}</span></p>
                  )}
                  {detailRow.link_to_huddle && (
                    <p className="text-[#a08060]">Huddle: <span className="text-[#c4b49a]">{detailRow.link_to_huddle}</span></p>
                  )}
                </div>
              )}

              {detailRow.description && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Description</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.description}</p>
                </div>
              )}

              <div className="border-t border-[#2e2016] pt-3">
                <p className="text-[#6b5a47] mb-1.5 font-medium flex items-center gap-1">
                  <ShieldAlert size={11} />Root Cause
                </p>
                {detailRow.root_cause
                  ? <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.root_cause}</p>
                  : (
                    <p className="text-[#6b5a47] italic text-[11px]">Not yet identified — update after investigation.</p>
                  )
                }
              </div>

              {/* Quick status update */}
              <div className="border-t border-[#2e2016] pt-3">
                <p className="text-[#6b5a47] mb-2 font-medium flex items-center gap-1"><Activity size={11} />Update Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s}
                      onClick={() => saveCell(detailRow.id, 'status', s)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors
                        ${detailRow.status === s
                          ? (STATUS_COLORS[s] ?? 'bg-[#c8843a] text-white') + ' ring-1 ring-white/20'
                          : 'bg-[#120d08] text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {orgId && (
              <div className="border-t border-[#2e2016] px-4 py-3">
                <RecordComments recordId={detailRow.id} tableName="issues_breakdowns" orgId={orgId} />
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
        <NewIssueModal orgId={orgId} onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['issues', orgId] })} />
      )}

      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">Click row to open details · Double-click a cell to edit inline · Use status buttons in panel to quickly update</p>
      </div>
    </div>
  )
}