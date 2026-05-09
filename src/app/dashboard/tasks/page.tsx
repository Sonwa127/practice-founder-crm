'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import {
  Search, Filter, ArrowUpDown, Download, RefreshCw, Plus, X,
  ChevronDown, ChevronUp, ChevronsUpDown, Check, Loader2,
  AlertCircle, Clock, User, Briefcase, Link2, Flag, Repeat,
  Timer, ListTodo, Play, Square, RotateCcw, SlidersHorizontal,
  Group, Calendar, Upload, LayoutGrid
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowHeight = 'compact' | 'medium' | 'tall'

type Task = {
  id: string; org_id: string; task_title: string; status: string
  due_date: string | null; assigned_to: string | null
  function: string | null; priority: string | null
  type_of_task: string | null; frequency: string | null
  frequency_days: number | null
  estimated_time: number | null; actual_time: number | null
  description: string | null
  linked_deliverable: string | null; linked_issue: string | null
  created_at: string
}
type SortConfig = { key: keyof Task; dir: 'asc' | 'desc' } | null

// ─── Constants ────────────────────────────────────────────────────────────────
// Spec-correct statuses (spec doc §3a-c)
const STATUS_OPTIONS    = ['To Do', 'In Progress', 'Revision Required', 'Manager Review', 'Complete', 'Cancelled']
const PRIORITY_OPTIONS  = ['Not Important & Not Urgent', 'Urgent & Not Important', 'Important & Not Urgent', 'Urgent & Important']
const TYPE_OPTIONS      = ['React', 'Improve', 'Maintain-Routine']
const FREQUENCY_OPTIONS = ['One-Time', 'Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annual', 'Trigger-Based']
const FUNCTION_OPTIONS  = [
  'Clinical Care', 'Patient Services', 'Patient Access & Front Desk',
  'Revenue Cycle & Finance', 'Operations', 'Marketing',
  'Human Resources & Staffing', 'Compliance', 'Leadership',
  'Legal & Risk', 'IT & Infrastructure',
  'Leadership & Strategic Growth', 'Quality Improvement & Maintenance'
]

const STATUS_COLORS: Record<string, string> = {
  'To Do':             'bg-[#2e2016] text-[#c8843a]',
  'In Progress':       'bg-[#0f2318] text-[#4ade80]',
  'Revision Required': 'bg-[#1e1020] text-[#c084fc]',
  'Manager Review':    'bg-[#1a1a0f] text-[#facc15]',
  'Complete':          'bg-[#0f2318] text-[#86efac]',
  'Cancelled':         'bg-[#1e1409] text-[#6b5a47]',
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

// Description auto-template (spec §2a)
const DESCRIPTION_TEMPLATE = `What is the purpose of this task?


What resources are needed to complete this task?


How do we know this task is done?
`

const DEMO: Task[] = [
  { id: 'd1', org_id: 'demo', task_title: 'Audit top 3 denial reasons (last 30 days)', status: 'To Do', due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], assigned_to: null, function: 'Revenue Cycle & Finance', priority: 'Urgent & Important', type_of_task: 'Maintain-Routine', frequency: 'Monthly', frequency_days: 30, estimated_time: 1.5, actual_time: null, description: DESCRIPTION_TEMPLATE, linked_deliverable: null, linked_issue: null, created_at: new Date().toISOString() },
  { id: 'd2', org_id: 'demo', task_title: 'Close all open charts from today', status: 'In Progress', due_date: new Date().toISOString().split('T')[0], assigned_to: null, function: 'Clinical Care', priority: 'Urgent & Important', type_of_task: 'Maintain-Routine', frequency: 'Daily', frequency_days: 1, estimated_time: 1, actual_time: null, description: DESCRIPTION_TEMPLATE, linked_deliverable: null, linked_issue: null, created_at: new Date().toISOString() },
  { id: 'd3', org_id: 'demo', task_title: 'Follow up on denied claims batch', status: 'Manager Review', due_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], assigned_to: null, function: 'Revenue Cycle & Finance', priority: 'Important & Not Urgent', type_of_task: 'React', frequency: 'Trigger-Based', frequency_days: null, estimated_time: 2, actual_time: null, description: DESCRIPTION_TEMPLATE, linked_deliverable: null, linked_issue: null, created_at: new Date().toISOString() },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtHours(h: number | null) {
  if (h == null) return '—'
  return h < 1 ? `${Math.round(h * 60)}m` : `${h}h`
}
function isOverdue(due: string | null, status: string) {
  if (!due || status === 'Complete' || status === 'Cancelled') return false
  return new Date(due) < new Date()
}
function secondsToHours(s: number) { return Math.round((s / 3600) * 100) / 100 }
function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// ─── Timer widget (spec §2c) ──────────────────────────────────────────────────
function TaskTimer({ taskId, initialHours, onSave }: {
  taskId: string; initialHours: number | null; onSave: (hours: number) => void
}) {
  const lsKey = `pf_timer_${taskId}`
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [elapsed, setElapsed] = useState<number>(() => {
    try {
      const s = localStorage.getItem(lsKey)
      if (s) {
        const { elapsedSeconds, startedAt } = JSON.parse(s)
        if (startedAt) return elapsedSeconds + Math.floor((Date.now() - startedAt) / 1000)
        return elapsedSeconds
      }
    } catch {}
    return initialHours ? Math.round(initialHours * 3600) : 0
  })
  const [running, setRunning] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(lsKey)
      if (s) return !!JSON.parse(s).startedAt
    } catch {}
    return false
  })

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function start() {
    const startedAt = Date.now() - elapsed * 1000
    try { localStorage.setItem(lsKey, JSON.stringify({ elapsedSeconds: elapsed, startedAt })) } catch {}
    setRunning(true)
  }
  function stop() {
    setRunning(false)
    try { localStorage.setItem(lsKey, JSON.stringify({ elapsedSeconds: elapsed, startedAt: null })) } catch {}
    onSave(secondsToHours(elapsed))
  }
  function reset() {
    setRunning(false)
    setElapsed(0)
    try { localStorage.removeItem(lsKey) } catch {}
    onSave(0)
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-xs tabular-nums ${running ? 'text-[#4ade80] animate-pulse' : elapsed > 0 ? 'text-[#c4b49a]' : 'text-[#6b5a47]'}`}>
        {formatTime(elapsed)}
      </span>
      {!running ? (
        <button onClick={start} title="Start timer"
          className="p-1 rounded bg-[#c8843a]/20 text-[#c8843a] border border-[#c8843a]/30 hover:bg-[#c8843a]/30 transition-colors">
          <Play size={10} />
        </button>
      ) : (
        <button onClick={stop} title="Stop and save"
          className="p-1 rounded bg-[#0f2318] text-[#4ade80] border border-[#4ade80]/30 hover:bg-[#0f2318]/80 transition-colors">
          <Square size={10} />
        </button>
      )}
      {elapsed > 0 && !running && (
        <button onClick={reset} title="Reset timer"
          className="p-1 rounded text-[#6b5a47] border border-[#2e2016] hover:text-[#f87171] transition-colors">
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  )
}

// ─── Inline cell editors ──────────────────────────────────────────────────────
function SelectCell({ value, options, onSave, onCancel }: { value: string; options: string[]; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <select autoFocus defaultValue={value}
      onBlur={e => onSave(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
function TextCell({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <input autoFocus defaultValue={value}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value); if (e.key === 'Escape') onCancel() }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none" />
  )
}
function DateCell({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <input type="date" autoFocus defaultValue={value ?? ''}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value); if (e.key === 'Escape') onCancel() }}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none" />
  )
}
function NumberCell({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <input type="number" step="0.5" autoFocus defaultValue={value ?? ''}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value); if (e.key === 'Escape') onCancel() }}
      className="w-24 bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none text-right" />
  )
}

// ─── New Task Modal ───────────────────────────────────────────────────────────
function NewTaskModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    task_title: '', status: 'To Do', due_date: '',
    function: '', priority: '', type_of_task: '', frequency: 'One-Time',
    estimated_time: '',
    description: DESCRIPTION_TEMPLATE,   // auto-populate (spec §2a)
    assigned_to: '',
    linked_issue: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [employees,  setEmployees]  = useState<{ id: string; name: string }[]>([])
  const [openIssues, setOpenIssues] = useState<{ id: string; issue_name: string }[]>([])

  useEffect(() => {
    supabase.from('employees').select('id, name').eq('org_id', orgId).order('name')
      .then(({ data }) => setEmployees((data ?? []) as { id: string; name: string }[]))
    supabase.from('issues_breakdowns').select('id, issue_name').eq('org_id', orgId)
      .in('status', ['Open', 'Investigating']).order('issue_name')
      .then(({ data }) => setOpenIssues((data ?? []) as { id: string; issue_name: string }[]))
  }, [orgId])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.task_title.trim()) { setErr('Task title is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('tasks').insert({
      org_id: orgId, task_title: form.task_title.trim(),
      status: form.status, due_date: form.due_date || null,
      function: form.function || null, priority: form.priority || null,
      type_of_task: form.type_of_task || null, frequency: form.frequency || null,
      estimated_time: form.estimated_time ? parseFloat(form.estimated_time) : null,
      description: form.description || null,
      assigned_to: form.assigned_to || null,
      linked_issue: form.linked_issue || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(); onClose()
  }

  const cls = 'w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none transition-colors'
  const lbl = 'block text-[#a08060] text-xs mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
          <h2 className="text-[#c4b49a] font-semibold flex items-center gap-2"><ListTodo size={15} className="text-[#c8843a]" />New Task</h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[78vh] overflow-y-auto">
          {err && <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2"><AlertCircle size={13} />{err}</div>}
          <div>
            <label className={lbl}>Task Title *</label>
            <input value={form.task_title} onChange={e => set('task_title', e.target.value)} placeholder="Action-based title…" className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={cls}>
                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={cls} />
            </div>
          </div>
          <div>
            <label className={lbl}>Assigned To</label>
            <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className={cls}>
              <option value="">— Unassigned —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={cls}>
                <option value="">— Select —</option>
                {PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Type</label>
              <select value={form.type_of_task} onChange={e => set('type_of_task', e.target.value)} className={cls}>
                <option value="">— Select —</option>
                {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Function</label>
              <select value={form.function} onChange={e => set('function', e.target.value)} className={cls}>
                <option value="">— Select —</option>
                {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Frequency</label>
              <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className={cls}>
                {FREQUENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Estimated Time (hours)</label>
            <input type="number" step="0.5" min="0" value={form.estimated_time} onChange={e => set('estimated_time', e.target.value)} placeholder="e.g. 1.5" className={cls} />
          </div>
          <div>
            <label className={lbl}>
              Description
              <span className="text-[#6b5a47] ml-1.5 font-normal normal-case">auto-filled with template — answer all 3 questions</span>
            </label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={7}
              className={cls + ' resize-none font-mono text-xs leading-relaxed'} />
          </div>
          <div>
            <label className={lbl}>Linked Issue <span className="text-[#6b5a47] font-normal">(optional)</span></label>
            <select value={form.linked_issue} onChange={e => set('linked_issue', e.target.value)} className={cls}>
              <option value="">— None —</option>
              {openIssues.map(i => <option key={i.id} value={i.id}>{i.issue_name}</option>)}
            </select>
          </div>
          {form.frequency !== 'One-Time' && form.frequency !== 'Trigger-Based' && (
            <p className="text-[#c8843a] text-[11px] bg-[#2e2016]/60 rounded px-3 py-2 flex items-center gap-1.5">
              <Repeat size={11} />When marked Complete, this task will auto-recur ({form.frequency})
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Create Task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const supabase    = createClient()
  const queryClient = useQueryClient()
  const { orgId, employeeId, canViewAll, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)

  const [search, setSearch]                 = useState('')
  const [rowHeight, setRowHeight]           = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig]         = useState<SortConfig>({ key: 'due_date', dir: 'asc' })
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFunction, setFilterFunction] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Task | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [editCell, setEditCell]             = useState<{ id: string; key: keyof Task } | null>(null)
  const [showFilters, setShowFilters]       = useState(false)

  // Maps for relation display
  const [issueMap,       setIssueMap]       = useState<Record<string, string>>({})
  const [deliverableMap, setDeliverableMap] = useState<Record<string, string>>({})
  const [employeeOpts,   setEmployeeOpts]   = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (!orgId) return
    supabase.from('issues_breakdowns').select('id, issue_name').eq('org_id', orgId)
      .then(({ data }) => { const m: Record<string,string> = {}; (data ?? []).forEach((r: {id:string;issue_name:string}) => { m[r.id] = r.issue_name }); setIssueMap(m) })
    supabase.from('deliverables').select('id, deliverable_name').eq('org_id', orgId)
      .then(({ data }) => { const m: Record<string,string> = {}; (data ?? []).forEach((r: {id:string;deliverable_name:string}) => { m[r.id] = r.deliverable_name }); setDeliverableMap(m) })
    supabase.from('employees').select('id, name').eq('org_id', orgId).order('name')
      .then(({ data }) => setEmployeeOpts((data ?? []) as { id: string; name: string }[]))
  }, [orgId])

  const { data: tasks, isLoading, refetch } = useQuery<Task[]>({
    queryKey: ['tasks', orgId, employeeId, canViewAll],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('tasks').select('*').eq('org_id', orgId!)
      // Role filter: member sees only their own tasks (spec §5a)
      if (!canViewAll && employeeId) q = q.eq('assigned_to', employeeId)
      const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })

  const rows   = tasks ?? (isLoading ? [] : DEMO)
  const isDemo = !tasks && !isLoading

  const patchMutation = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: keyof Task; value: unknown }) => {
      if (isDemo) return
      const { error } = await supabase.from('tasks').update({ [key]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', orgId, employeeId, canViewAll] }),
  })

  const saveCell = useCallback((id: string, key: keyof Task, value: unknown) => {
    patchMutation.mutate({ id, key, value })
    setEditCell(null)
    setDetailRow(prev => prev?.id === id ? { ...prev, [key]: value } as Task : prev)
  }, [patchMutation])

  const saveTimer = useCallback((id: string, hours: number) => {
    patchMutation.mutate({ id, key: 'actual_time', value: hours })
    setDetailRow(prev => prev?.id === id ? { ...prev, actual_time: hours } as Task : prev)
  }, [patchMutation])

  const filtered = useMemo(() => {
    let r = rows
    if (search) { const q = search.toLowerCase(); r = r.filter(x => x.task_title.toLowerCase().includes(q) || (x.function ?? '').toLowerCase().includes(q)) }
    if (filterStatus)   r = r.filter(x => x.status === filterStatus)
    if (filterPriority) r = r.filter(x => x.priority === filterPriority)
    if (filterFunction) r = r.filter(x => x.function === filterFunction)
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
  const overdue  = filtered.filter(x => isOverdue(x.due_date, x.status)).length

  function toggleSort(key: keyof Task) {
    setSortConfig(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }
  function SortIcon({ col }: { col: keyof Task }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc' ? <ChevronUp size={11} className="text-[#c8843a]" /> : <ChevronDown size={11} className="text-[#c8843a]" />
  }
  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'

  function exportCsv() {
    const h = ['Title','Status','Due Date','Assigned To','Priority','Type','Frequency','Function','Est.','Actual']
    const csv = [h, ...filtered.map(r => [r.task_title, r.status, r.due_date ?? '', r.assigned_to ? resolveName(r.assigned_to) : '', r.priority ?? '', r.type_of_task ?? '', r.frequency ?? '', r.function ?? '', r.estimated_time ?? '', r.actual_time ?? ''])].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = 'tasks.csv'; a.click()
  }

  if (userLoading) return <div className="flex items-center justify-center h-64 text-[#6b5a47]"><Loader2 size={24} className="animate-spin mr-2" />Loading…</div>

  const COLS: { key: keyof Task; label: string; icon: React.ReactNode; w: string }[] = [
    { key: 'task_title',    label: 'Task Title',  icon: <ListTodo size={11} />,   w: 'min-w-[240px]' },
    { key: 'status',        label: 'Status',      icon: <Check size={11} />,      w: 'min-w-[140px]' },
    { key: 'due_date',      label: 'Due Date',    icon: <Calendar size={11} />,   w: 'min-w-[110px]' },
    { key: 'assigned_to',   label: 'Assigned To', icon: <User size={11} />,       w: 'min-w-[130px]' },
    { key: 'priority',      label: 'Priority',    icon: <Flag size={11} />,       w: 'min-w-[100px]' },
    { key: 'type_of_task',  label: 'Type',        icon: <Briefcase size={11} />,  w: 'min-w-[110px]' },
    { key: 'frequency',     label: 'Frequency',   icon: <Repeat size={11} />,     w: 'min-w-[100px]' },
    { key: 'function',      label: 'Function',    icon: <Briefcase size={11} />,  w: 'min-w-[160px]' },
    { key: 'estimated_time',label: 'Est.',        icon: <Timer size={11} />,      w: 'min-w-[60px]' },
    { key: 'actual_time',   label: 'Actual',      icon: <Clock size={11} />,      w: 'min-w-[140px]' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a]">Tasks</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          {total} task{total !== 1 ? 's' : ''} &nbsp;·&nbsp;
          <span className="text-[#86efac]">{complete} complete</span>
          {overdue > 0 && <> &nbsp;·&nbsp; <span className="text-[#f87171]">{overdue} overdue</span></>}
          {!canViewAll && <span className="ml-2 text-[#c8843a]">· My tasks only</span>}
          {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!(filterStatus || filterPriority || filterFunction) },
          { icon: <ArrowUpDown size={13} />, label: 'Sort' },
          { icon: <Group size={13} />, label: 'Group' },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${btn.active ? 'bg-[#c8843a]/20 text-[#c8843a] border border-[#c8843a]/30' : 'text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] border border-transparent'}`}>
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
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><RefreshCw size={13} />Refresh</button>
        <div className="flex-1" />
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8843a] hover:bg-[#d4924a] text-white text-xs font-medium rounded-lg transition-colors">
          <Plus size={13} />New Task
        </button>
      </div>

      {showFilters && (
        <div className="px-4 py-2.5 border-b border-[#2e2016] bg-[#1e1409] flex items-center gap-3 flex-wrap">
          <span className="text-[#6b5a47] text-xs font-medium">Filters:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Statuses</option>{STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Priorities</option>{PRIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterFunction} onChange={e => setFilterFunction(e.target.value)} className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Functions</option>{FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          {(filterStatus || filterPriority || filterFunction) && (
            <button onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterFunction('') }} className="flex items-center gap-1 text-xs text-[#f87171]"><X size={11} />Clear</button>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())} className="accent-[#c8843a]" />
                </th>
                {COLS.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className={`${col.w} px-3 py-2 text-left font-medium text-[#a08060] cursor-pointer hover:text-[#c4b49a] select-none whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1">{col.icon}{col.label}<SortIcon col={col.key} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={COLS.length+1} className="text-center py-16 text-[#6b5a47]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={COLS.length+1} className="text-center py-16 text-[#6b5a47]">No tasks found.</td></tr>
              ) : filtered.map((row, idx) => {
                const sel    = selectedIds.has(row.id)
                const od     = isOverdue(row.due_date, row.status)
                const active = detailRow?.id === row.id
                return (
                  <tr key={row.id} onClick={() => setDetailRow(active ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors ${sel ? 'bg-[#c8843a]/5' : ''} ${active ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'} hover:bg-[#c8843a]/5`}>
                    <td className="px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel}
                        onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(row.id) : n.delete(row.id); setSelectedIds(n) }} className="accent-[#c8843a]" />
                    </td>
                    {/* Task Title */}
                    <td className={`px-3 ${rowPy} font-medium text-[#c4b49a]`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'task_title' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'task_title'
                        ? <TextCell value={row.task_title} onSave={v => saveCell(row.id, 'task_title', v)} onCancel={() => setEditCell(null)} />
                        : <span className="flex items-center gap-1.5">{row.task_title}{od && <span className="text-[#f87171] text-[10px]">overdue</span>}{row.frequency && row.frequency !== 'One-Time' && row.frequency !== 'Trigger-Based' && <Repeat size={9} className="text-[#c8843a] shrink-0" title={`Recurs ${row.frequency}`} />}</span>}
                    </td>
                    {/* Status */}
                    <td className={`px-3 ${rowPy}`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'status' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'status'
                        ? <SelectCell value={row.status} options={STATUS_OPTIONS} onSave={v => saveCell(row.id, 'status', v)} onCancel={() => setEditCell(null)} />
                        : <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status] ?? ''}`}>{row.status}</span>}
                    </td>
                    {/* Due Date */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap ${od ? 'text-[#f87171]' : 'text-[#c4b49a]'}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'due_date' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'due_date'
                        ? <DateCell value={row.due_date ?? ''} onSave={v => saveCell(row.id, 'due_date', v || null)} onCancel={() => setEditCell(null)} />
                        : fmtDate(row.due_date)}
                    </td>
                    {/* Assigned To */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}
                      onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'assigned_to' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'assigned_to'
                        ? <SelectCell value={row.assigned_to ?? ''} options={['', ...employeeOpts.map(e => e.id)].map(id => id)} onSave={v => saveCell(row.id, 'assigned_to', v || null)} onCancel={() => setEditCell(null)} />
                        : (row.assigned_to ? resolveName(row.assigned_to) : <span className="text-[#6b5a47]">Unassigned</span>)}
                    </td>
                    {/* Priority */}
                    <td className={`px-3 ${rowPy} whitespace-nowrap`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'priority' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'priority'
                        ? <SelectCell value={row.priority ?? ''} options={PRIORITY_OPTIONS} onSave={v => saveCell(row.id, 'priority', v)} onCancel={() => setEditCell(null)} />
                        : <span className={`text-xs ${PRIORITY_COLORS[row.priority ?? ''] ?? 'text-[#6b5a47]'}`}>{PRIORITY_SHORT[row.priority ?? ''] ?? '—'}</span>}
                    </td>
                    {/* Type */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'type_of_task' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'type_of_task'
                        ? <SelectCell value={row.type_of_task ?? ''} options={TYPE_OPTIONS} onSave={v => saveCell(row.id, 'type_of_task', v)} onCancel={() => setEditCell(null)} />
                        : (row.type_of_task ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>
                    {/* Frequency */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'frequency' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'frequency'
                        ? <SelectCell value={row.frequency ?? ''} options={FREQUENCY_OPTIONS} onSave={v => saveCell(row.id, 'frequency', v)} onCancel={() => setEditCell(null)} />
                        : (row.frequency ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>
                    {/* Function */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'function' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'function'
                        ? <SelectCell value={row.function ?? ''} options={FUNCTION_OPTIONS} onSave={v => saveCell(row.id, 'function', v)} onCancel={() => setEditCell(null)} />
                        : (row.function ?? <span className="text-[#6b5a47]">—</span>)}
                    </td>
                    {/* Est. */}
                    <td className={`px-3 ${rowPy} text-[#a08060] text-right tabular-nums`} onDoubleClick={e => { e.stopPropagation(); setEditCell({ id: row.id, key: 'estimated_time' }) }}>
                      {editCell?.id === row.id && editCell?.key === 'estimated_time'
                        ? <NumberCell value={String(row.estimated_time ?? '')} onSave={v => saveCell(row.id, 'estimated_time', v ? parseFloat(v) : null)} onCancel={() => setEditCell(null)} />
                        : fmtHours(row.estimated_time)}
                    </td>
                    {/* Actual — timer widget */}
                    <td className={`px-3 ${rowPy}`} onClick={e => e.stopPropagation()}>
                      <TaskTimer taskId={row.id} initialHours={row.actual_time} onSave={h => saveTimer(row.id, h)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] text-[#6b5a47] font-medium sticky bottom-0">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060]">{filtered.length} tasks</td>
                  <td className="px-3 py-2"><span className="text-[#86efac] text-[10px]">{complete} complete</span></td>
                  <td className="px-3 py-2">{overdue > 0 && <span className="text-[#f87171] text-[10px]">{overdue} overdue</span>}</td>
                  <td colSpan={5} />
                  <td className="px-3 py-2 text-right tabular-nums">{fmtHours(filtered.reduce((s,r) => s+(r.estimated_time??0),0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#a08060]">{fmtHours(filtered.reduce((s,r) => s+(r.actual_time??0),0))}</td>
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
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5 ${STATUS_COLORS[detailRow.status] ?? ''}`}>{detailRow.status}</span>
                <h3 className="text-[#c4b49a] font-semibold text-sm leading-snug">{detailRow.task_title}</h3>
                {detailRow.frequency && detailRow.frequency !== 'One-Time' && (
                  <p className="text-[#c8843a] text-[10px] mt-1 flex items-center gap-1"><Repeat size={9} />Recurs {detailRow.frequency}</p>
                )}
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              {/* Timer — prominent */}
              <div className="bg-[#120d08] rounded-lg border border-[#2e2016] px-3 py-2.5">
                <p className="text-[#6b5a47] text-[10px] mb-1.5 flex items-center gap-1"><Clock size={10} />Actual Time Tracker</p>
                <TaskTimer taskId={detailRow.id} initialHours={detailRow.actual_time} onSave={h => saveTimer(detailRow.id, h)} />
                {detailRow.actual_time != null && detailRow.actual_time > 0 && (
                  <p className="text-[#6b5a47] text-[10px] mt-1">Saved: {fmtHours(detailRow.actual_time)}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />Due Date</p>
                  <p className={isOverdue(detailRow.due_date, detailRow.status) ? 'text-[#f87171]' : 'text-[#c4b49a]'}>{fmtDate(detailRow.due_date)}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Flag size={11} />Priority</p>
                  <p className={PRIORITY_COLORS[detailRow.priority ?? ''] ?? 'text-[#6b5a47]'}>{detailRow.priority ?? '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><User size={11} />Assigned To</p>
                  <p className="text-[#c4b49a]">{detailRow.assigned_to ? resolveName(detailRow.assigned_to) : <span className="text-[#6b5a47]">Unassigned</span>}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Timer size={11} />Estimated</p>
                  <p className="text-[#c4b49a]">{fmtHours(detailRow.estimated_time)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Type</p>
                  <p className="text-[#c4b49a]">{detailRow.type_of_task ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Repeat size={11} />Frequency</p>
                  <p className="text-[#c4b49a]">{detailRow.frequency ?? '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Function</p>
                <p className="text-[#a08060]">{detailRow.function ?? '—'}</p>
              </div>
              {(detailRow.linked_issue || detailRow.linked_deliverable) && (
                <div className="border-t border-[#2e2016] pt-3 space-y-1.5">
                  <p className="text-[#6b5a47] font-medium flex items-center gap-1"><Link2 size={11} />Linked</p>
                  {detailRow.linked_issue && <p className="text-[#a08060]">Issue: <span className="text-[#c4b49a]">{issueMap[detailRow.linked_issue] ?? detailRow.linked_issue}</span></p>}
                  {detailRow.linked_deliverable && <p className="text-[#a08060]">Deliverable: <span className="text-[#c4b49a]">{deliverableMap[detailRow.linked_deliverable] ?? detailRow.linked_deliverable}</span></p>}
                </div>
              )}
              {detailRow.description && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Description</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap text-[11px]">{detailRow.description}</p>
                </div>
              )}
            </div>
            {orgId && <div className="border-t border-[#2e2016] px-4 py-3"><RecordComments recordId={detailRow.id} tableName="tasks" orgId={orgId} /></div>}
            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto">
              <button onClick={() => setDetailRow(null)} className="w-full py-2 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016] hover:border-[#c8843a]/30 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        )}
      </div>

      {showNewModal && orgId && (
        <NewTaskModal orgId={orgId} onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['tasks', orgId, employeeId, canViewAll] })} />
      )}
      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">Double-click any cell to edit · Timer auto-saves on Stop · Recurring tasks auto-create on Complete</p>
      </div>
    </div>
  )
}