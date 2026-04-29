'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RoleGuard from '@/components/RoleGuard'
import RecordComments from '@/components/RecordComments'
import {
  Search, SlidersHorizontal, Filter, ArrowUpDown, Group,
  Calendar, Download, Upload, RefreshCw, Plus, X,
  ChevronDown, ChevronUp, ChevronsUpDown,
  Check, Loader2, AlertCircle, User, Flag,
  Briefcase, Link2, FileText, LayoutGrid, ExternalLink
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowHeight = 'compact' | 'medium' | 'tall'
type SortConfig = { key: keyof Project; dir: 'asc' | 'desc' } | null

type Project = {
  id: string
  org_id: string
  project_name: string
  owner: string | null          // employees.id
  status: string
  project_timeline_start: string | null
  project_timeline_end: string | null
  functions: string | null
  priority: string | null
  project_brief: string | null
  project_updates: string | null
  submitted_by: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  'To-Do', 'In-Process', 'Revision Required', 'Manager Review',
  'Client Review', 'Requirements to Clarify', 'Complete',
  'Unrolled', 'Incomplete', 'Cancelled'
]

const PRIORITY_OPTIONS = [
  'Not Important & Not Urgent',
  'Urgent & Not Important',
  'Important & Not Urgent',
  'Urgent & Important',
]

const FUNCTION_OPTIONS = [
  'Clinical Care', 'Patient Services', 'Patient Access & Front Desk',
  'Revenue Cycle & Finance', 'Operations', 'Marketing',
  'Human Resources & Staffing', 'Compliance', 'Leadership',
  'Legal & Risk', 'IT & Infrastructure',
  'Leadership & Strategic Growth', 'Quality Improvement & Maintenance'
]

const STATUS_COLORS: Record<string, string> = {
  'To-Do':                  'bg-[#2e2016] text-[#c8843a]',
  'In-Process':             'bg-[#0f2318] text-[#4ade80]',
  'Revision Required':      'bg-[#1e1020] text-[#c084fc]',
  'Manager Review':         'bg-[#1a1a0f] text-[#facc15]',
  'Client Review':          'bg-[#0f1f2e] text-[#60a5fa]',
  'Requirements to Clarify':'bg-[#1e1409] text-[#fb923c]',
  'Complete':               'bg-[#0f2318] text-[#86efac]',
  'Unrolled':               'bg-[#1e1409] text-[#94a3b8]',
  'Incomplete':             'bg-[#2e1010] text-[#f87171]',
  'Cancelled':              'bg-[#1e1409] text-[#6b5a47]',
}

const PRIORITY_COLORS: Record<string, string> = {
  'Not Important & Not Urgent': 'text-[#6b5a47]',
  'Urgent & Not Important':     'text-[#fb923c]',
  'Important & Not Urgent':     'text-[#60a5fa]',
  'Urgent & Important':         'text-[#f87171]',
}

const PRIORITY_SHORT: Record<string, string> = {
  'Not Important & Not Urgent': 'Low',
  'Urgent & Not Important':     'Urgent',
  'Important & Not Urgent':     'Important',
  'Urgent & Important':         '🔴 Critical',
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO: Project[] = [
  {
    id: 'dp-1', org_id: 'demo', project_name: 'Billing SOP Overhaul',
    owner: null, status: 'In-Process',
    project_timeline_start: '2025-04-01', project_timeline_end: '2025-05-31',
    functions: 'Revenue Cycle & Finance', priority: 'Urgent & Important',
    project_brief: 'Rewrite all billing SOPs to align with new payer contracts and reduce denial rate.',
    project_updates: 'Week 1: Initial audit complete. Week 2: Draft SOPs in review.',
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'dp-2', org_id: 'demo', project_name: 'New MA Onboarding Process',
    owner: null, status: 'To-Do',
    project_timeline_start: '2025-05-01', project_timeline_end: '2025-05-30',
    functions: 'Human Resources & Staffing', priority: 'Important & Not Urgent',
    project_brief: 'Build a repeatable onboarding checklist and training materials for new MAs.',
    project_updates: null,
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'dp-3', org_id: 'demo', project_name: 'Patient Communication Templates',
    owner: null, status: 'Manager Review',
    project_timeline_start: '2025-03-15', project_timeline_end: '2025-04-30',
    functions: 'Patient Services', priority: 'Important & Not Urgent',
    project_brief: 'Create standardised templates for appointment reminders, follow-ups, and no-show outreach.',
    project_updates: 'Draft templates submitted for review.',
    submitted_by: null, created_at: new Date().toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(end: string | null, status: string) {
  if (!end || status === 'Complete' || status === 'Cancelled') return false
  return new Date(end) < new Date()
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

function DateCell({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <input type="date" autoFocus defaultValue={value ?? ''}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none" />
  )
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ orgId, onClose, onCreated }: {
  orgId: string; onClose: () => void; onCreated: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    project_name: '', status: 'To-Do', functions: '',
    priority: '', project_timeline_start: '', project_timeline_end: '',
    project_brief: '', project_updates: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.project_name.trim()) { setErr('Project name is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('projects').insert({
      org_id: orgId,
      project_name: form.project_name.trim(),
      status: form.status,
      functions: form.functions || null,
      priority: form.priority || null,
      project_timeline_start: form.project_timeline_start || null,
      project_timeline_end: form.project_timeline_end || null,
      project_brief: form.project_brief || null,
      project_updates: form.project_updates || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
          <h2 className="text-[#c4b49a] font-semibold">New Project</h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2">
              <AlertCircle size={13} />{err}
            </div>
          )}
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Project Name *</label>
            <input value={form.project_name} onChange={e => set('project_name', e.target.value)}
              placeholder="Descriptive project name…"
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                <option value="">— Select —</option>
                {PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Function</label>
            <select value={form.functions} onChange={e => set('functions', e.target.value)}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
              <option value="">— Select —</option>
              {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Timeline Start</label>
              <input type="date" value={form.project_timeline_start} onChange={e => set('project_timeline_start', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Timeline End</label>
              <input type="date" value={form.project_timeline_end} onChange={e => set('project_timeline_end', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Project Brief</label>
            <textarea value={form.project_brief} onChange={e => set('project_brief', e.target.value)}
              placeholder="Full project description or brief…" rows={3}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Project Updates</label>
            <textarea value={form.project_updates} onChange={e => set('project_updates', e.target.value)}
              placeholder="Running log of weekly updates…" rows={2}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page content ─────────────────────────────────────────────────────────────
function ProjectsPageContent() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { orgId } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)

  const [search, setSearch]         = useState('')
  const [rowHeight, setRowHeight]   = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'project_timeline_end', dir: 'asc' })
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFunction, setFilterFunction] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Project | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [editCell, setEditCell] = useState<{ id: string; key: keyof Project } | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: projects, isLoading, refetch } = useQuery<Project[]>({
    queryKey: ['projects', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('org_id', orgId!)
        .order('project_timeline_end', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },
  })

  const rows = projects ?? (isLoading ? [] : DEMO)
  const isDemo = !projects && !isLoading

  const patchMutation = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: keyof Project; value: unknown }) => {
      if (isDemo) return
      const { error } = await supabase.from('projects').update({ [key]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', orgId] }),
  })

  const saveCell = useCallback((id: string, key: keyof Project, value: unknown) => {
    patchMutation.mutate({ id, key, value })
    setEditCell(null)
    setDetailRow(prev => prev?.id === id ? { ...prev, [key]: value } as Project : prev)
  }, [patchMutation])

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => x.project_name.toLowerCase().includes(q) || (x.functions ?? '').toLowerCase().includes(q))
    }
    if (filterStatus)   r = r.filter(x => x.status === filterStatus)
    if (filterPriority) r = r.filter(x => x.priority === filterPriority)
    if (filterFunction) r = r.filter(x => x.functions === filterFunction)
    if (sortConfig) {
      const { key, dir } = sortConfig
      r = [...r].sort((a, b) => dir === 'asc'
        ? String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
        : String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
    }
    return r
  }, [rows, search, filterStatus, filterPriority, filterFunction, sortConfig])

  const total    = filtered.length
  const complete = filtered.filter(x => x.status === 'Complete').length
  const overdue  = filtered.filter(x => isOverdue(x.project_timeline_end, x.status)).length

  function toggleSort(key: keyof Project) {
    setSortConfig(prev => prev?.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: keyof Project }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'

  function exportCsv() {
    const headers = ['Project Name', 'Status', 'Owner', 'Start', 'End', 'Priority', 'Function']
    const csv2 = [headers, ...filtered.map(r => [
      r.project_name, r.status, r.owner ? resolveName(r.owner) : '',
      r.project_timeline_start ?? '', r.project_timeline_end ?? '',
      r.priority ?? '', r.functions ?? ''
    ])].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv2]))
    a.download = 'projects.csv'; a.click()
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#c4b49a]">Projects</h1>
          <p className="text-xs text-[#6b5a47] mt-0.5">
            {total} project{total !== 1 ? 's' : ''} &nbsp;·&nbsp;
            <span className="text-[#86efac]">{complete} complete</span>
            {overdue > 0 && <> &nbsp;·&nbsp; <span className="text-[#f87171]">{overdue} overdue</span></>}
            {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!(filterStatus || filterPriority || filterFunction) },
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
          <Plus size={13} />New Project
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
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterFunction} onChange={e => setFilterFunction(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Functions</option>
            {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          {(filterStatus || filterPriority || filterFunction) && (
            <button onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterFunction('') }}
              className="flex items-center gap-1 text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors">
              <X size={11} />Clear
            </button>
          )}
        </div>
      )}

      {/* Table + detail panel */}
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
                  { key: 'project_name' as keyof Project,          label: 'Project Name',   icon: <Briefcase size={11} />, w: 'min-w-[220px]' },
                  { key: 'status' as keyof Project,                label: 'Status',          icon: <Check size={11} />, w: 'min-w-[140px]' },
                  { key: 'owner' as keyof Project,                 label: 'Owner',           icon: <User size={11} />, w: 'min-w-[130px]' },
                  { key: 'project_timeline_start' as keyof Project,label: 'Start',           icon: <Calendar size={11} />, w: 'min-w-[110px]' },
                  { key: 'project_timeline_end' as keyof Project,  label: 'End',             icon: <Calendar size={11} />, w: 'min-w-[110px]' },
                  { key: 'priority' as keyof Project,              label: 'Priority',        icon: <Flag size={11} />, w: 'min-w-[130px]' },
                  { key: 'functions' as keyof Project,             label: 'Function',        icon: <Briefcase size={11} />, w: 'min-w-[160px]' },
                  { key: 'project_updates' as keyof Project,       label: 'Latest Update',   icon: <FileText size={11} />, w: 'min-w-[200px]' },
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
                <tr><td colSpan={9} className="text-center py-16 text-[#6b5a47]">
                  <Loader2 size={20} className="animate-spin inline mr-2" />Loading projects…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-[#6b5a47]">No projects found.</td></tr>
              ) : filtered.map((row, idx) => {
                const selected = selectedIds.has(row.id)
                const overdueFlag = isOverdue(row.project_timeline_end, row.status)
                const isActive = detailRow?.id === row.id

                return (
                  <tr key={row.id}
                    onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors group
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

                    {/* Project Name */}
                    <td className={`pf-sticky-cell px-3 ${rowPy} font-medium text-[#c4b49a]`} style={{ left: 32 }}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'project_name' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'project_name' ? (
                        <TextCell value={row.project_name}
                          onSave={v => saveCell(row.id, 'project_name', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {row.project_name}
                          {overdueFlag && <span className="text-[#f87171] text-[10px] font-normal">overdue</span>}
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

                    {/* Owner */}
                    <td className={`px-3 ${rowPy} text-[#a08060]`}>
                      {row.owner ? resolveName(row.owner) : <span className="text-[#6b5a47]">Unassigned</span>}
                    </td>

                    {/* Start */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'project_timeline_start' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'project_timeline_start' ? (
                        <DateCell value={row.project_timeline_start ?? ''}
                          onSave={v => saveCell(row.id, 'project_timeline_start', v || null)}
                          onCancel={() => setEditCell(null)} />
                      ) : fmtDate(row.project_timeline_start)}
                    </td>

                    {/* End */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap ${overdueFlag ? 'text-[#f87171]' : 'text-[#a08060]'}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'project_timeline_end' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'project_timeline_end' ? (
                        <DateCell value={row.project_timeline_end ?? ''}
                          onSave={v => saveCell(row.id, 'project_timeline_end', v || null)}
                          onCancel={() => setEditCell(null)} />
                      ) : fmtDate(row.project_timeline_end)}
                    </td>

                    {/* Priority */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'priority' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'priority' ? (
                        <SelectCell value={row.priority ?? ''} options={PRIORITY_OPTIONS}
                          onSave={v => saveCell(row.id, 'priority', v)} onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`text-xs ${PRIORITY_COLORS[row.priority ?? ''] ?? 'text-[#6b5a47]'}`}>
                          {PRIORITY_SHORT[row.priority ?? ''] ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Function */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'functions' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'functions' ? (
                        <SelectCell value={row.functions ?? ''} options={FUNCTION_OPTIONS}
                          onSave={v => saveCell(row.id, 'functions', v)} onCancel={() => setEditCell(null)} />
                      ) : (row.functions ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>

                    {/* Latest Update */}
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[220px]`}>
                      {row.project_updates
                        ? <span className="truncate block">{row.project_updates.split('\n').at(-1)?.trim() ?? '—'}</span>
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] text-[#6b5a47] sticky bottom-0">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060] font-medium">{filtered.length} projects</td>
                  <td className="px-3 py-2"><span className="text-[#86efac] text-[10px]">{complete} complete</span></td>
                  <td className="px-3 py-2">
                    {overdue > 0 && <span className="text-[#f87171] text-[10px]">{overdue} overdue</span>}
                  </td>
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
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5 ${STATUS_COLORS[detailRow.status] ?? ''}`}>
                  {detailRow.status}
                </span>
                <h3 className="text-[#c4b49a] font-semibold text-sm leading-snug">{detailRow.project_name}</h3>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors mt-0.5 shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><User size={11} />Owner</p>
                  <p className="text-[#c4b49a]">
                    {detailRow.owner ? resolveName(detailRow.owner) : <span className="text-[#6b5a47]">Unassigned</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Flag size={11} />Priority</p>
                  <p className={PRIORITY_COLORS[detailRow.priority ?? ''] ?? 'text-[#6b5a47]'}>{detailRow.priority ?? '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />Start</p>
                  <p className="text-[#c4b49a]">{fmtDate(detailRow.project_timeline_start)}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />End</p>
                  <p className={isOverdue(detailRow.project_timeline_end, detailRow.status) ? 'text-[#f87171]' : 'text-[#c4b49a]'}>
                    {fmtDate(detailRow.project_timeline_end)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Function</p>
                <p className="text-[#a08060]">{detailRow.functions ?? '—'}</p>
              </div>

              {detailRow.project_brief && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium flex items-center gap-1"><FileText size={11} />Project Brief</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.project_brief}</p>
                </div>
              )}

              {detailRow.project_updates && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium flex items-center gap-1"><Link2 size={11} />Project Updates</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.project_updates}</p>
                </div>
              )}
            </div>

            {orgId && (
              <div className="border-t border-[#2e2016] px-4 py-3">
                <RecordComments recordId={detailRow.id} tableName="projects" orgId={orgId} />
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
        <NewProjectModal orgId={orgId} onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['projects', orgId] })} />
      )}

      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">Click row to open details · Double-click a cell to edit inline</p>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <RoleGuard allow={['admin']}>
      <ProjectsPageContent />
    </RoleGuard>
  )
}