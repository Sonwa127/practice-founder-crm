'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import {
  Search, SlidersHorizontal, Filter, ArrowUpDown, Group,
  Calendar, Rows2, LayoutGrid, Download, Upload, RefreshCw,
  Plus, X, ChevronDown, ChevronUp, ChevronsUpDown, Pencil,
  Check, Loader2, AlertCircle, Clock, User, Briefcase,
  Link2, Flag, Repeat, Timer, ListTodo, ExternalLink
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowHeight = 'compact' | 'medium' | 'tall'

type Task = {
  id: string
  org_id: string
  task_title: string
  status: string
  due_date: string | null
  assigned_to: string | null   // employees.id
  function: string | null
  priority: string | null
  type_of_task: string | null
  frequency: string | null
  estimated_time: number | null
  actual_time: number | null
  description: string | null
  linked_project: string | null
  linked_deliverable: string | null
  linked_issue: string | null
  submitted_by: string | null
  created_at: string
}

type SortConfig = { key: keyof Task; dir: 'asc' | 'desc' } | null

// ─── Constants ─────────────────────────────────────────────────────────────────
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

const TYPE_OPTIONS = ['React', 'Improve', 'Maintain-Routine']

const FREQUENCY_OPTIONS = [
  'One-Time', 'Daily', 'Weekly', 'Bi-Weekly',
  'Monthly', 'Quarterly', 'Annual', 'Trigger-Based'
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

// ─── Demo data fallback ────────────────────────────────────────────────────────
const DEMO_TASKS: Task[] = [
  {
    id: 'demo-1', org_id: 'demo', task_title: 'Review and update billing SOP',
    status: 'In-Process', due_date: '2025-05-10', assigned_to: null,
    function: 'Revenue Cycle & Finance', priority: 'Important & Not Urgent',
    type_of_task: 'Improve', frequency: 'One-Time',
    estimated_time: 2, actual_time: null,
    description: 'Review current billing SOP and update for new payer rules.',
    linked_project: null, linked_deliverable: null, linked_issue: null,
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2', org_id: 'demo', task_title: 'Complete daily chart closures',
    status: 'To-Do', due_date: '2025-05-01', assigned_to: null,
    function: 'Clinical Care', priority: 'Urgent & Important',
    type_of_task: 'Maintain-Routine', frequency: 'Daily',
    estimated_time: 1, actual_time: null,
    description: 'Close all open charts from today\'s visits.',
    linked_project: null, linked_deliverable: null, linked_issue: null,
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3', org_id: 'demo', task_title: 'Follow up on denied claims',
    status: 'Manager Review', due_date: '2025-05-05', assigned_to: null,
    function: 'Revenue Cycle & Finance', priority: 'Urgent & Not Important',
    type_of_task: 'React', frequency: 'Trigger-Based',
    estimated_time: 3, actual_time: null,
    description: 'Investigate and resubmit denied claims from last week.',
    linked_project: null, linked_deliverable: null, linked_issue: null,
    submitted_by: null, created_at: new Date().toISOString(),
  },
  {
    id: 'demo-4', org_id: 'demo', task_title: 'Onboard new MA staff member',
    status: 'To-Do', due_date: '2025-05-15', assigned_to: null,
    function: 'Human Resources & Staffing', priority: 'Important & Not Urgent',
    type_of_task: 'Improve', frequency: 'One-Time',
    estimated_time: 4, actual_time: null,
    description: 'Run through orientation checklist and system access.',
    linked_project: null, linked_deliverable: null, linked_issue: null,
    submitted_by: null, created_at: new Date().toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(h: number | null) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h}h`
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'Complete' || status === 'Cancelled') return false
  return new Date(due) < new Date()
}

// ─── Cell editors ─────────────────────────────────────────────────────────────
function SelectCell({ value, options, onSave, onCancel }: {
  value: string; options: string[]; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <select
      autoFocus
      defaultValue={value}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => e.key === 'Escape' && onCancel()}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function TextCell({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <input
      autoFocus
      defaultValue={value}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none"
    />
  )
}

function DateCell({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  return (
    <input
      type="date"
      autoFocus
      defaultValue={value ?? ''}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none"
    />
  )
}

// ─── New Record Modal ─────────────────────────────────────────────────────────
function NewTaskModal({
  orgId, onClose, onCreated
}: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    task_title: '', status: 'To-Do', due_date: '',
    function: '', priority: '', type_of_task: '', frequency: 'One-Time',
    estimated_time: '', description: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.task_title.trim()) { setErr('Task title is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('tasks').insert({
      org_id: orgId,
      task_title: form.task_title.trim(),
      status: form.status,
      due_date: form.due_date || null,
      function: form.function || null,
      priority: form.priority || null,
      type_of_task: form.type_of_task || null,
      frequency: form.frequency || null,
      estimated_time: form.estimated_time ? parseFloat(form.estimated_time) : null,
      description: form.description || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
          <h2 className="text-[#c4b49a] font-semibold">New Task</h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2">
              <AlertCircle size={13} /> {err}
            </div>
          )}
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Task Title *</label>
            <input value={form.task_title} onChange={e => set('task_title', e.target.value)}
              placeholder="Action-based title…"
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
              <label className="block text-[#a08060] text-xs mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                <option value="">— Select —</option>
                {PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Type</label>
              <select value={form.type_of_task} onChange={e => set('type_of_task', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                <option value="">— Select —</option>
                {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Function</label>
              <select value={form.function} onChange={e => set('function', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                <option value="">— Select —</option>
                {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => set('frequency', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                {FREQUENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Estimated Time (hours)</label>
            <input type="number" step="0.5" min="0" value={form.estimated_time}
              onChange={e => set('estimated_time', e.target.value)}
              placeholder="e.g. 1.5"
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Purpose, resources needed, done criteria…"
              rows={3}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Create Task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)

  // ── Table state
  const [search, setSearch]         = useState('')
  const [rowHeight, setRowHeight]   = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'due_date', dir: 'asc' })
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFunction, setFilterFunction] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Task | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [editCell, setEditCell] = useState<{ id: string; key: keyof Task } | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // ── Fetch
  const { data: tasks, isLoading, refetch } = useQuery<Task[]>({
    queryKey: ['tasks', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('org_id', orgId!)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })

  const rows = tasks ?? (isLoading ? [] : DEMO_TASKS)
  const isDemo = !tasks && !isLoading

  // ── Mutation: patch a single cell
  const patchMutation = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: keyof Task; value: unknown }) => {
      if (isDemo) return
      const { error } = await supabase.from('tasks').update({ [key]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', orgId] }),
  })

  const saveCell = useCallback((id: string, key: keyof Task, value: unknown) => {
    patchMutation.mutate({ id, key, value })
    setEditCell(null)
    // Optimistic update on detailRow
    setDetailRow(prev => prev?.id === id ? { ...prev, [key]: value } as Task : prev)
  }, [patchMutation])

  // ── Filter + sort
  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.task_title.toLowerCase().includes(q) ||
        (x.function ?? '').toLowerCase().includes(q) ||
        (x.status ?? '').toLowerCase().includes(q)
      )
    }
    if (filterStatus)   r = r.filter(x => x.status === filterStatus)
    if (filterPriority) r = r.filter(x => x.priority === filterPriority)
    if (filterFunction) r = r.filter(x => x.function === filterFunction)
    if (sortConfig) {
      const { key, dir } = sortConfig
      r = [...r].sort((a, b) => {
        const av = a[key] ?? ''
        const bv = b[key] ?? ''
        return dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      })
    }
    return r
  }, [rows, search, filterStatus, filterPriority, filterFunction, sortConfig])

  // ── Counts
  const total    = filtered.length
  const complete = filtered.filter(x => x.status === 'Complete').length
  const overdue  = filtered.filter(x => isOverdue(x.due_date, x.status)).length

  // ── Sort toggle
  function toggleSort(key: keyof Task) {
    setSortConfig(prev =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  function SortIcon({ col }: { col: keyof Task }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  // ── Row height styles
  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'

  // ── Export CSV
  function exportCsv() {
    const headers = ['Title','Status','Due Date','Priority','Type','Function','Frequency','Est. Time','Actual Time']
    const rows2 = filtered.map(r => [
      r.task_title, r.status, r.due_date ?? '', r.priority ?? '',
      r.type_of_task ?? '', r.function ?? '', r.frequency ?? '',
      r.estimated_time ?? '', r.actual_time ?? ''
    ])
    const csv = [headers, ...rows2].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv]))
    a.download = 'tasks.csv'; a.click()
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6b5a47]">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">

      {/* ── Page header */}
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#c4b49a]">Tasks</h1>
          <p className="text-xs text-[#6b5a47] mt-0.5">
            {total} task{total !== 1 ? 's' : ''} &nbsp;·&nbsp;
            <span className="text-[#86efac]">{complete} complete</span>
            {overdue > 0 && <> &nbsp;·&nbsp; <span className="text-[#f87171]">{overdue} overdue</span></>}
            {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
          </p>
        </div>
      </div>

      {/* ── Toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors"
          />
        </div>

        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />

        {/* Toolbar buttons */}
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!(filterStatus || filterPriority || filterFunction) },
          { icon: <ArrowUpDown size={13} />, label: 'Sort' },
          { icon: <Group size={13} />, label: 'Group' },
          { icon: <Calendar size={13} />, label: 'Date' },
        ].map(btn => (
          <button key={btn.label}
            onClick={btn.onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors
              ${btn.active ? 'bg-[#c8843a]/20 text-[#c8843a] border border-[#c8843a]/30' : 'text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] border border-transparent'}`}>
            {btn.icon}{btn.label}
          </button>
        ))}

        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />

        {/* Row height */}
        <div className="flex rounded border border-[#2e2016] overflow-hidden">
          {(['compact', 'medium', 'tall'] as RowHeight[]).map(h => (
            <button key={h} onClick={() => setRowHeight(h)}
              className={`px-2 py-1.5 text-xs transition-colors ${rowHeight === h ? 'bg-[#2e2016] text-[#c8843a]' : 'text-[#6b5a47] hover:text-[#c4b49a]'}`}>
              {h === 'compact' ? '—' : h === 'medium' ? '≡' : '☰'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent">
          <LayoutGrid size={13} />Views
        </button>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent">
          <Download size={13} />Export
        </button>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent">
          <Upload size={13} />Import
        </button>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent">
          <RefreshCw size={13} />Refresh
        </button>

        <div className="flex-1" />

        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8843a] hover:bg-[#d4924a] text-white text-xs font-medium rounded-lg transition-colors">
          <Plus size={13} />New Task
        </button>
      </div>

      {/* ── Filter bar */}
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

      {/* ── Main content: table + optional detail panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                {/* Checkbox */}
                <th className="pf-sticky-checkbox w-8 px-2 py-2">
                  <input type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                    className="accent-[#c8843a]" />
                </th>
                {/* Columns */}
                {[
                  { key: 'task_title' as keyof Task,  label: 'Task Title',   icon: <ListTodo size={11} />, w: 'min-w-[240px]' },
                  { key: 'status' as keyof Task,       label: 'Status',       icon: <Check size={11} />, w: 'min-w-[140px]' },
                  { key: 'due_date' as keyof Task,     label: 'Due Date',     icon: <Calendar size={11} />, w: 'min-w-[110px]' },
                  { key: 'assigned_to' as keyof Task,  label: 'Assigned To',  icon: <User size={11} />, w: 'min-w-[130px]' },
                  { key: 'priority' as keyof Task,     label: 'Priority',     icon: <Flag size={11} />, w: 'min-w-[130px]' },
                  { key: 'type_of_task' as keyof Task, label: 'Type',         icon: <Briefcase size={11} />, w: 'min-w-[110px]' },
                  { key: 'frequency' as keyof Task,    label: 'Frequency',    icon: <Repeat size={11} />, w: 'min-w-[100px]' },
                  { key: 'function' as keyof Task,     label: 'Function',     icon: <Briefcase size={11} />, w: 'min-w-[150px]' },
                  { key: 'estimated_time' as keyof Task, label: 'Est.',       icon: <Timer size={11} />, w: 'min-w-[60px]' },
                  { key: 'actual_time' as keyof Task,  label: 'Actual',       icon: <Clock size={11} />, w: 'min-w-[60px]' },
                ].map(col => (
                  <th key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`${col.w} px-3 py-2 text-left font-medium text-[#a08060] cursor-pointer hover:text-[#c4b49a] select-none whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1">
                      {col.icon}{col.label}<SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-[#6b5a47]">
                    <Loader2 size={20} className="animate-spin inline mr-2" />Loading tasks…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-[#6b5a47]">
                    No tasks found.
                  </td>
                </tr>
              ) : filtered.map((row, idx) => {
                const selected = selectedIds.has(row.id)
                const overduFlag = isOverdue(row.due_date, row.status)
                const isActive = detailRow?.id === row.id

                return (
                  <tr key={row.id}
                    onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors group
                      ${selected ? 'pf-row-selected' : ''}
                      ${isActive ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'}
                      hover:bg-[#c8843a]/5`}>

                    {/* Checkbox */}
                    <td className="pf-sticky-checkbox px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(row.id) : next.delete(row.id)
                          setSelectedIds(next)
                        }}
                        className="accent-[#c8843a]" />
                    </td>

                    {/* Task Title — pinned */}
                    <td className={`pf-sticky-cell left-8 px-3 ${rowPy} font-medium text-[#c4b49a]`}
                      style={{ left: 32 }}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'task_title' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'task_title' ? (
                        <TextCell value={row.task_title}
                          onSave={v => saveCell(row.id, 'task_title', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {row.task_title}
                          {overduFlag && <span className="text-[#f87171] text-[10px] font-normal">overdue</span>}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'status' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'status' ? (
                        <SelectCell value={row.status} options={STATUS_OPTIONS}
                          onSave={v => saveCell(row.id, 'status', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status] ?? 'bg-[#2e2016] text-[#c4b49a]'}`}>
                          {row.status}
                        </span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap ${overduFlag ? 'text-[#f87171]' : 'text-[#c4b49a]'}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'due_date' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'due_date' ? (
                        <DateCell value={row.due_date ?? ''}
                          onSave={v => saveCell(row.id, 'due_date', v || null)}
                          onCancel={() => setEditCell(null)} />
                      ) : fmtDate(row.due_date)}
                    </td>

                    {/* Assigned To */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}>
                      {row.assigned_to ? resolveName(row.assigned_to) : <span className="text-[#6b5a47]">Unassigned</span>}
                    </td>

                    {/* Priority */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'priority' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'priority' ? (
                        <SelectCell value={row.priority ?? ''} options={PRIORITY_OPTIONS}
                          onSave={v => saveCell(row.id, 'priority', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (
                        <span className={`text-xs ${PRIORITY_COLORS[row.priority ?? ''] ?? 'text-[#6b5a47]'}`}>
                          {PRIORITY_SHORT[row.priority ?? ''] ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'type_of_task' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'type_of_task' ? (
                        <SelectCell value={row.type_of_task ?? ''} options={TYPE_OPTIONS}
                          onSave={v => saveCell(row.id, 'type_of_task', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (row.type_of_task ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>

                    {/* Frequency */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'frequency' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'frequency' ? (
                        <SelectCell value={row.frequency ?? ''} options={FREQUENCY_OPTIONS}
                          onSave={v => saveCell(row.id, 'frequency', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (row.frequency ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>

                    {/* Function */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'function' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'function' ? (
                        <SelectCell value={row.function ?? ''} options={FUNCTION_OPTIONS}
                          onSave={v => saveCell(row.id, 'function', v)}
                          onCancel={() => setEditCell(null)} />
                      ) : (row.function ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>

                    {/* Est Time */}
                    <td className={`px-3 ${rowPy} text-[#a08060] text-right tabular-nums`}>
                      {fmtTime(row.estimated_time)}
                    </td>

                    {/* Actual Time */}
                    <td className={`px-3 ${rowPy} text-[#a08060] text-right tabular-nums`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'actual_time' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'actual_time' ? (
                        <input type="number" step="0.5" autoFocus
                          defaultValue={row.actual_time ?? ''}
                          onBlur={e => saveCell(row.id, 'actual_time', e.target.value ? parseFloat(e.target.value) : null)}
                          onKeyDown={e => e.key === 'Escape' && setEditCell(null)}
                          className="w-16 bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none text-right" />
                      ) : fmtTime(row.actual_time)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* ── Totals footer */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] text-[#6b5a47] font-medium sticky bottom-0">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060]">{filtered.length} tasks</td>
                  <td className="px-3 py-2">
                    <span className="text-[#86efac] text-[10px]">{complete} complete</span>
                  </td>
                  <td className="px-3 py-2">
                    {overdue > 0 && <span className="text-[#f87171] text-[10px]">{overdue} overdue</span>}
                  </td>
                  <td colSpan={5} />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtTime(filtered.reduce((s, r) => s + (r.estimated_time ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtTime(filtered.reduce((s, r) => s + (r.actual_time ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Detail panel */}
        {detailRow && (
          <div className="w-[380px] border-l border-[#2e2016] bg-[#1e1409] flex flex-col overflow-y-auto shrink-0 transition-all">
            {/* Panel header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
              <div className="flex-1 pr-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5 ${STATUS_COLORS[detailRow.status] ?? ''}`}>
                  {detailRow.status}
                </span>
                <h3 className="text-[#c4b49a] font-semibold text-sm leading-snug">{detailRow.task_title}</h3>
              </div>
              <button onClick={() => setDetailRow(null)}
                className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors mt-0.5 shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Fields */}
            <div className="px-4 py-3 space-y-3 text-xs">
              {/* Row: due + priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />Due Date</p>
                  <p className={isOverdue(detailRow.due_date, detailRow.status) ? 'text-[#f87171]' : 'text-[#c4b49a]'}>
                    {fmtDate(detailRow.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Flag size={11} />Priority</p>
                  <p className={PRIORITY_COLORS[detailRow.priority ?? ''] ?? 'text-[#6b5a47]'}>
                    {detailRow.priority ?? '—'}
                  </p>
                </div>
              </div>

              {/* Row: assigned + type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><User size={11} />Assigned To</p>
                  <p className="text-[#c4b49a]">
                    {detailRow.assigned_to ? resolveName(detailRow.assigned_to) : <span className="text-[#6b5a47]">Unassigned</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Type</p>
                  <p className="text-[#c4b49a]">{detailRow.type_of_task ?? '—'}</p>
                </div>
              </div>

              {/* Row: freq + function */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Repeat size={11} />Frequency</p>
                  <p className="text-[#c4b49a]">{detailRow.frequency ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Function</p>
                  <p className="text-[#a08060]">{detailRow.function ?? '—'}</p>
                </div>
              </div>

              {/* Row: est + actual */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Timer size={11} />Est. Time</p>
                  <p className="text-[#c4b49a]">{fmtTime(detailRow.estimated_time)}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Clock size={11} />Actual Time</p>
                  <p className="text-[#c4b49a]">{fmtTime(detailRow.actual_time)}</p>
                </div>
              </div>

              {/* Linked records */}
              {(detailRow.linked_project || detailRow.linked_deliverable || detailRow.linked_issue) && (
                <div className="border-t border-[#2e2016] pt-3 space-y-1.5">
                  <p className="text-[#6b5a47] font-medium flex items-center gap-1"><Link2 size={11} />Linked Records</p>
                  {detailRow.linked_project && (
                    <div className="flex items-center gap-1.5 text-[#a08060]">
                      <ExternalLink size={10} />
                      <span>Project: <span className="text-[#c4b49a]">{detailRow.linked_project}</span></span>
                    </div>
                  )}
                  {detailRow.linked_deliverable && (
                    <div className="flex items-center gap-1.5 text-[#a08060]">
                      <ExternalLink size={10} />
                      <span>Deliverable: <span className="text-[#c4b49a]">{detailRow.linked_deliverable}</span></span>
                    </div>
                  )}
                  {detailRow.linked_issue && (
                    <div className="flex items-center gap-1.5 text-[#a08060]">
                      <ExternalLink size={10} />
                      <span>Issue: <span className="text-[#c4b49a]">{detailRow.linked_issue}</span></span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {detailRow.description && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Description</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.description}</p>
                </div>
              )}
            </div>

            {/* Comments */}
            {orgId && (
              <div className="border-t border-[#2e2016] px-4 py-3">
                <RecordComments recordId={detailRow.id} tableName="tasks" orgId={orgId} />
              </div>
            )}

            {/* Close */}
            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto">
              <button onClick={() => setDetailRow(null)}
                className="w-full py-2 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016] hover:border-[#c8843a]/30 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── New Task Modal */}
      {showNewModal && orgId && (
        <NewTaskModal
          orgId={orgId}
          onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['tasks', orgId] })}
        />
      )}

      {/* Tip */}
      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">
          Click row to open details · Double-click a cell to edit inline
        </p>
      </div>
    </div>
  )
}