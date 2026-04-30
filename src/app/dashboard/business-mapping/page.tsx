'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RoleGuard from '@/components/RoleGuard'
import {
  Search, RefreshCw, Loader2, ChevronDown, ChevronUp, ChevronsUpDown,
  Layers, GitBranch, ListChecks, BookOpen, UserCheck,
  Users, Stethoscope, Star, X, Plus, Pencil, Trash2, AlertTriangle,
} from 'lucide-react'

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'core_functions', label: 'Core Functions', icon: <Layers size={13} /> },
  { key: 'systems',        label: 'Systems',         icon: <GitBranch size={13} /> },
  { key: 'processes',      label: 'Processes',       icon: <ListChecks size={13} /> },
  { key: 'sops',           label: 'SOPs',            icon: <BookOpen size={13} /> },
  { key: 'roles',          label: 'Roles',           icon: <UserCheck size={13} /> },
  { key: 'employees',      label: 'Employees',       icon: <Users size={13} /> },
  { key: 'services',       label: 'Services',        icon: <Stethoscope size={13} /> },
  { key: 'membership',     label: 'Membership',      icon: <Star size={13} /> },
] as const

type TabKey = typeof TABS[number]['key']
type Row = Record<string, unknown>

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Active':            'bg-[#0f2318] text-[#86efac]',
  'Excellent':         'bg-[#0f2318] text-[#4ade80]',
  'Started':           'bg-[#1a1a0f] text-[#facc15]',
  'To Improve':        'bg-[#1e1020] text-[#c084fc]',
  'Not Started':       'bg-[#1e1409] text-[#6b5a47]',
  'Inactive':          'bg-[#2e1010] text-[#f87171]',
  'Filled':            'bg-[#0f2318] text-[#86efac]',
  'Not Filled':        'bg-[#2e1010] text-[#f87171]',
  'Temporarily Filled':'bg-[#1a1a0f] text-[#facc15]',
  'Currently In Use':  'bg-[#0f2318] text-[#86efac]',
  'Paused':            'bg-[#1a1a0f] text-[#facc15]',
  'Not In Use':        'bg-[#1e1409] text-[#6b5a47]',
}

function StatusBadge({ val }: { val: string | null | undefined }) {
  if (!val) return <span className="text-[#6b5a47]">—</span>
  const cls = STATUS_COLORS[val] ?? 'bg-[#2e2016] text-[#c4b49a]'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {val}
    </span>
  )
}

function Cell({ val }: { val: unknown }) {
  if (val === null || val === undefined || val === '') return <span className="text-[#6b5a47]">—</span>
  if (typeof val === 'boolean') return val
    ? <span className="text-[#86efac]">Yes</span>
    : <span className="text-[#f87171]">No</span>
  if (typeof val === 'number') return <span className="tabular-nums">{val}</span>
  const str = String(val)
  if (str.length > 120) return <span className="text-[#a08060]">{str.slice(0, 117)}…</span>
  return <span className="text-[#a08060]">{str}</span>
}

// ─── Column definitions ───────────────────────────────────────────────────────
const COLUMNS: Record<TabKey, { key: string; label: string; w?: string }[]> = {
  core_functions: [
    { key: 'core_function_name', label: 'Function Name', w: 'min-w-[200px]' },
    { key: 'goal',               label: 'Goal',          w: 'min-w-[240px]' },
    { key: 'how_it_is_done',     label: "How It's Done", w: 'min-w-[260px]' },
  ],
  systems: [
    { key: 'system_name', label: 'System Name', w: 'min-w-[200px]' },
    { key: 'objective',   label: 'Objective',   w: 'min-w-[260px]' },
    { key: 'status',      label: 'Status',      w: 'min-w-[120px]' },
  ],
  processes: [
    { key: 'process_name',   label: 'Process Name',  w: 'min-w-[200px]' },
    { key: 'status',         label: 'Status',         w: 'min-w-[120px]' },
    { key: 'purpose',        label: 'Purpose',        w: 'min-w-[240px]' },
    { key: 'process_detail', label: 'Process Detail', w: 'min-w-[260px]' },
  ],
  sops: [
    { key: 'sop_name',             label: 'SOP Name',  w: 'min-w-[200px]' },
    { key: 'status',               label: 'Status',    w: 'min-w-[120px]' },
    { key: 'purpose',              label: 'Purpose',   w: 'min-w-[240px]' },
    { key: 'resources_needed',     label: 'Resources', w: 'min-w-[180px]' },
    { key: 'input',                label: 'Trigger',   w: 'min-w-[160px]' },
    { key: 'how_we_know_complete', label: 'Done When', w: 'min-w-[180px]' },
  ],
  roles: [
    { key: 'role_name',   label: 'Role Name',   w: 'min-w-[160px]' },
    { key: 'description', label: 'Description', w: 'min-w-[260px]' },
    { key: 'status',      label: 'Status',      w: 'min-w-[140px]' },
  ],
  employees: [
    { key: 'name',         label: 'Name',  w: 'min-w-[160px]' },
    { key: 'email',        label: 'Email', w: 'min-w-[200px]' },
    { key: 'phone_number', label: 'Phone', w: 'min-w-[140px]' },
  ],
  services: [
    { key: 'service_name', label: 'Service',        w: 'min-w-[180px]' },
    { key: 'status',       label: 'Status',         w: 'min-w-[130px]' },
    { key: 'category',     label: 'Category',       w: 'min-w-[150px]' },
    { key: 'primary_type', label: 'Payment Type',   w: 'min-w-[120px]' },
    { key: 'duration',     label: 'Duration (min)', w: 'min-w-[110px]' },
  ],
  membership: [
    { key: 'plan_name',           label: 'Plan Name',          w: 'min-w-[160px]' },
    { key: 'monthly_price',       label: 'Monthly Price',      w: 'min-w-[120px]' },
    { key: 'visits_included',     label: 'Visits',             w: 'min-w-[80px]' },
    { key: 'iv_included',         label: 'IV Sessions',        w: 'min-w-[90px]' },
    { key: 'shots_included',      label: 'Shots',              w: 'min-w-[70px]' },
    { key: 'labs_included',       label: 'Labs',               w: 'min-w-[160px]' },
    { key: 'supplement_discount', label: 'Supplement Discount',w: 'min-w-[150px]' },
    { key: 'description',         label: 'Description',        w: 'min-w-[240px]' },
  ],
}

const TABLE_NAMES: Record<TabKey, string> = {
  core_functions: 'core_functions',
  systems:        'systems',
  processes:      'processes',
  sops:           'sops',
  roles:          'roles',
  employees:      'employees',
  services:       'services',
  membership:     'membership',
}

// The primary "name" column for each tab — used for validation + delete confirm
const NAME_KEY: Record<TabKey, string> = {
  core_functions: 'core_function_name',
  systems:        'system_name',
  processes:      'process_name',
  sops:           'sop_name',
  roles:          'role_name',
  employees:      'name',
  services:       'service_name',
  membership:     'plan_name',
}

// ─── Form field definitions ───────────────────────────────────────────────────
// One source of truth for every field in every form — drives both create + edit
type FieldDef = {
  key: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select'
  required?: boolean
  rows?: number
  options?: string[]
  placeholder?: string
}

const PROCESS_STATUSES = ['Not Started', 'Started', 'Active', 'To Improve', 'Excellent', 'Inactive']

const FORM_FIELDS: Record<TabKey, FieldDef[]> = {
  core_functions: [
    { key: 'core_function_name', label: 'Function Name', type: 'text',     required: true, placeholder: 'e.g. Clinical Care' },
    { key: 'goal',               label: 'Goal',          type: 'textarea',  placeholder: 'What is the goal of this function?' },
    { key: 'how_it_is_done',     label: 'How It Is Done',type: 'textarea',  rows: 4, placeholder: 'High-level description of how this function operates…' },
  ],
  systems: [
    { key: 'system_name', label: 'System Name', type: 'text',    required: true, placeholder: 'e.g. Billing & Claims System' },
    { key: 'objective',   label: 'Objective',   type: 'textarea', placeholder: 'What does this system achieve?' },
    { key: 'status',      label: 'Status',      type: 'select',   options: PROCESS_STATUSES },
  ],
  processes: [
    { key: 'process_name',   label: 'Process Name',   type: 'text',    required: true, placeholder: 'e.g. Claims Submission' },
    { key: 'status',         label: 'Status',          type: 'select',  options: PROCESS_STATUSES },
    { key: 'purpose',        label: 'Purpose',         type: 'textarea', placeholder: 'What is the goal of this process?' },
    { key: 'process_detail', label: 'Process Detail',  type: 'textarea', rows: 5, placeholder: 'Step-by-step description…' },
  ],
  sops: [
    { key: 'sop_name',             label: 'SOP Name',              type: 'text',    required: true, placeholder: 'e.g. How to Submit a Clean Claim' },
    { key: 'status',               label: 'Status',                type: 'select',  options: PROCESS_STATUSES },
    { key: 'purpose',              label: 'Purpose',               type: 'textarea', placeholder: 'What is the purpose of this SOP?' },
    { key: 'resources_needed',     label: 'Resources Needed',      type: 'textarea', placeholder: 'Tools, systems, or materials required…' },
    { key: 'input',                label: 'Input / Trigger',       type: 'text',     placeholder: 'What triggers or initiates this SOP?' },
    { key: 'steps',                label: 'Steps',                 type: 'textarea', rows: 7, placeholder: '1. First step\n2. Second step…' },
    { key: 'how_we_know_complete', label: "How We Know It's Complete", type: 'textarea', placeholder: 'Success criteria…' },
    { key: 'faqs',                 label: 'FAQs',                  type: 'textarea', rows: 4, placeholder: 'Frequently asked questions…' },
  ],
  roles: [
    { key: 'role_name',   label: 'Role Name',   type: 'text',    required: true, placeholder: 'e.g. Billing Staff' },
    { key: 'status',      label: 'Status',      type: 'select',  options: ['Not Filled', 'Filled', 'Temporarily Filled'] },
    { key: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'What does this role do and is responsible for?' },
  ],
  employees: [
    { key: 'name',         label: 'Full Name',    type: 'text',  required: true, placeholder: 'e.g. Michael Johnson' },
    { key: 'email',        label: 'Email',        type: 'email', placeholder: 'michael@practice.com' },
    { key: 'phone_number', label: 'Phone Number', type: 'tel',   placeholder: '+1 555 000 0000' },
  ],
  services: [
    { key: 'service_name', label: 'Service Name',      type: 'text',   required: true, placeholder: 'e.g. Annual Wellness Visit' },
    { key: 'status',       label: 'Status',            type: 'select', options: ['Currently In Use', 'Paused', 'Not In Use'] },
    { key: 'category',     label: 'Category',          type: 'select', options: ['', 'Preventative', 'Problem-Based', 'Wellness/Optimization', 'Procedure', 'Non-Revenue'] },
    { key: 'primary_type', label: 'Payment Type',      type: 'select', options: ['Insurance', 'Cash'] },
    { key: 'duration',     label: 'Duration (minutes)',type: 'number', placeholder: '30' },
  ],
  membership: [
    { key: 'plan_name',           label: 'Plan Name',           type: 'text',    required: true, placeholder: 'e.g. Wellness Gold' },
    { key: 'description',         label: 'Description',         type: 'textarea', placeholder: 'What does this plan include?' },
    { key: 'monthly_price',       label: 'Monthly Price ($)',   type: 'number',   placeholder: '199.00' },
    { key: 'visits_included',     label: 'Visits Included',     type: 'number',   placeholder: '4' },
    { key: 'iv_included',         label: 'IV Sessions Included',type: 'number',   placeholder: '2' },
    { key: 'shots_included',      label: 'Shots Included',      type: 'number',   placeholder: '1' },
    { key: 'labs_included',       label: 'Labs Included',       type: 'text',     placeholder: 'Annual CBC, CMP, lipid panel' },
    { key: 'supplement_discount', label: 'Supplement Discount', type: 'text',     placeholder: 'e.g. 15% off all supplements' },
  ],
}

// ─── CRUD Modal (slide-in panel, matches existing detail panel style) ─────────
const inputCls =
  'w-full bg-[#1a1410] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-3 py-2 ' +
  'outline-none focus:border-[#c8843a] placeholder-[#6b5a47] transition-colors'

function CrudModal({
  tab, mode, initial, orgId, onClose, onSaved,
}: {
  tab: TabKey
  mode: 'create' | 'edit'
  initial: Row
  orgId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const fields = FORM_FIELDS[tab]
  const nameKey = NAME_KEY[tab]
  const tableName = TABLE_NAMES[tab]

  const [form, setForm] = useState<Row>(() => {
    // Seed selects with their first option if empty
    const seed: Row = { ...initial }
    fields.forEach(f => {
      if (f.type === 'select' && f.options?.length && !seed[f.key]) {
        seed[f.key] = f.options[0] === '' ? f.options[1] ?? '' : f.options[0]
      }
    })
    return seed
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!String(form[nameKey] ?? '').trim()) {
      setError(`${fields.find(f => f.required)?.label ?? 'Name'} is required.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Convert number fields from string (HTML input) to actual numbers
      const payload: Row = { ...form }
      fields.forEach(f => {
        if (f.type === 'number' && payload[f.key] !== '' && payload[f.key] != null) {
          payload[f.key] = Number(payload[f.key])
        }
      })

      if (mode === 'create') {
        const { error: err } = await supabase
          .from(tableName)
          .insert({ ...payload, org_id: orgId })
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', initial.id)
        if (err) throw err
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const tabLabel = TABS.find(t => t.key === tab)?.label ?? tab
  const title = mode === 'create' ? `New ${tabLabel.replace(/s$/, '')}` : `Edit ${tabLabel.replace(/s$/, '')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="h-full w-[400px] bg-[#1e1409] border-l border-[#2e2016] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
          <h3 className="text-sm font-semibold text-[#c4b49a]">{title}</h3>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-[10px] font-medium text-[#6b5a47] uppercase tracking-wider mb-1.5">
                {field.label}{field.required && <span className="text-[#c8843a] ml-0.5">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={field.rows ?? 3}
                  placeholder={field.placeholder}
                  value={String(form[field.key] ?? '')}
                  onChange={e => set(field.key, e.target.value)}
                />
              ) : field.type === 'select' ? (
                <select
                  className={inputCls + ' cursor-pointer'}
                  value={String(form[field.key] ?? '')}
                  onChange={e => set(field.key, e.target.value)}
                >
                  {(field.options ?? []).map(o => (
                    <option key={o} value={o}>{o || '— Select —'}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={String(form[field.key] ?? '')}
                  onChange={e => set(field.key, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && (
            <p className="text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2e2016] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016]
              hover:border-[#c8843a]/30 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium bg-[#c8843a] hover:bg-[#d4944a] text-white
              rounded transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {mode === 'create' ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────
function DeleteDialog({
  name, onConfirm, onCancel, loading,
}: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl shadow-2xl p-5 w-full max-w-sm mx-4">
        <div className="flex gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#2e1010] flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={14} className="text-[#f87171]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#c4b49a]">Delete record?</p>
            <p className="text-xs text-[#6b5a47] mt-1">
              <span className="text-[#a08060]">"{name}"</span> will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016]
              hover:border-[#c8843a]/30 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-medium bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5]
              rounded transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BizTable ─────────────────────────────────────────────────────────────────
function BizTable({ tab, orgId }: { tab: TabKey; orgId: string }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const cols = COLUMNS[tab]
  const tableName = TABLE_NAMES[tab]
  const nameKey = NAME_KEY[tab]

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(cols[0].key)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [detailRow, setDetailRow] = useState<Row | null>(null)

  // CRUD state
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; row: Row }>({
    open: false, mode: 'create', row: {},
  })
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const queryKey = ['biz', tab, orgId]

  const { data, isLoading, refetch } = useQuery<Row[]>({
    queryKey,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('org_id', orgId)
        .order(cols[0].key, { ascending: true })
      if (error) {
        console.warn(`Table ${tableName}:`, error.message)
        return []
      }
      return (data ?? []) as Row[]
    },
  })

  const rows = data ?? []

  const filtered = rows
    .filter(row => {
      if (!search) return true
      const q = search.toLowerCase()
      return Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from(tableName).delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (!error) {
      qc.setQueryData<Row[]>(queryKey, old => (old ?? []).filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (detailRow?.id === deleteTarget.id) setDetailRow(null)
    }
  }

  const openCreate = () => setModal({ open: true, mode: 'create', row: {} })
  const openEdit = (row: Row, e: React.MouseEvent) => {
    e.stopPropagation()
    setModal({ open: true, mode: 'edit', row })
  }
  const openDelete = (row: Row, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTarget(row)
  }

  const tabLabel = TABS.find(t => t.key === tab)?.label ?? tab

  return (
    <div className="flex flex-col h-full">
      {/* Sub-toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab.replace('_', ' ')}…`}
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded
              pl-7 pr-3 py-1.5 w-52 outline-none focus:border-[#c8843a] transition-colors"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-[#6b5a47]
            hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>

        {/* NEW button */}
        <button
          onClick={openCreate}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium
            bg-[#c8843a]/15 text-[#c8843a] border border-[#c8843a]/30
            hover:bg-[#c8843a]/25 hover:border-[#c8843a]/50 transition-colors"
        >
          <Plus size={12} /> New {tabLabel.replace(/s$/, '')}
        </button>

        <span className="text-[10px] text-[#6b5a47] ml-auto">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table + detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                {cols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`${col.w ?? 'min-w-[140px]'} px-3 py-2 text-left font-medium
                      text-[#a08060] cursor-pointer hover:text-[#c4b49a] select-none whitespace-nowrap`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}<SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
                {/* Actions col */}
                <th className="w-16 px-2 py-2 text-right text-[10px] font-medium text-[#6b5a47]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-16 text-[#6b5a47]">
                    <Loader2 size={18} className="animate-spin inline mr-2" />Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-16 text-[#6b5a47]">
                    {search
                      ? 'No records match your search.'
                      : (
                        <div className="flex flex-col items-center gap-3">
                          <p>No {tab.replace('_', ' ')} yet.</p>
                          <button
                            onClick={openCreate}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium
                              bg-[#c8843a]/15 text-[#c8843a] border border-[#c8843a]/30
                              hover:bg-[#c8843a]/25 transition-colors"
                          >
                            <Plus size={12} /> Add the first one
                          </button>
                        </div>
                      )
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const isActive = detailRow === row
                  return (
                    <tr
                      key={String(row.id ?? idx)}
                      onClick={() => setDetailRow(isActive ? null : row)}
                      className={`border-b border-[#2e2016] cursor-pointer transition-colors group
                        ${isActive ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'}
                        hover:bg-[#c8843a]/5`}
                    >
                      {cols.map((col, ci) => (
                        <td key={col.key} className={`px-3 py-2.5 max-w-[280px]
                          ${ci === 0 ? 'font-medium text-[#c4b49a]' : ''}`}>
                          {col.key === 'status'
                            ? <StatusBadge val={row[col.key] as string} />
                            : <Cell val={row[col.key]} />
                          }
                        </td>
                      ))}
                      {/* Edit / Delete — visible on row hover */}
                      <td className="px-2 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => openEdit(row, e)}
                            title="Edit"
                            className="p-1 rounded text-[#6b5a47] hover:text-[#c8843a] hover:bg-[#2e2016] transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={e => openDelete(row, e)}
                            title="Delete"
                            className="p-1 rounded text-[#6b5a47] hover:text-[#f87171] hover:bg-[#2e1010] transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel — unchanged from original */}
        {detailRow && (
          <div className="w-[340px] border-l border-[#2e2016] bg-[#1e1409] flex flex-col overflow-y-auto shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
              <h4 className="text-[#c4b49a] font-semibold text-sm">
                {String(detailRow[cols[0].key] ?? 'Record')}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => openEdit(detailRow, e)}
                  className="p-1 rounded text-[#6b5a47] hover:text-[#c8843a] hover:bg-[#2e2016] transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDetailRow(null)}
                  className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors p-1"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              {Object.entries(detailRow)
                .filter(([k]) => !['id', 'org_id', 'created_at', 'updated_at'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[#6b5a47] mb-0.5 capitalize">{k.replace(/_/g, ' ')}</p>
                    {k === 'status'
                      ? <StatusBadge val={v as string} />
                      : typeof v === 'string' && v.length > 100
                        ? <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{v}</p>
                        : <p className="text-[#c4b49a]"><Cell val={v} /></p>
                    }
                  </div>
                ))}
            </div>
            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto space-y-2">
              <button
                onClick={e => openEdit(detailRow, e)}
                className="w-full py-1.5 text-xs text-[#c8843a] border border-[#c8843a]/30
                  hover:bg-[#c8843a]/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Pencil size={11} /> Edit this record
              </button>
              <button
                onClick={() => setDetailRow(null)}
                className="w-full py-1.5 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016]
                  hover:border-[#c8843a]/30 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CRUD modal */}
      {modal.open && (
        <CrudModal
          tab={tab}
          mode={modal.mode}
          initial={modal.row}
          orgId={orgId}
          onClose={() => setModal(m => ({ ...m, open: false }))}
          onSaved={() => {
            refetch()
            // Optimistically refresh detail panel if editing the open row
            if (modal.mode === 'edit' && detailRow?.id === modal.row.id) {
              setDetailRow(null)
            }
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteDialog
          name={String(deleteTarget[nameKey] ?? 'this record')}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function BusinessMappingContent() {
  const { orgId } = useOrgUser()
  const [activeTab, setActiveTab] = useState<TabKey>('core_functions')

  if (!orgId) return (
    <div className="flex items-center justify-center h-64 text-[#6b5a47]">
      <Loader2 size={20} className="animate-spin mr-2" />Loading…
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a]">Business Mapping HQ</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          Reference library — Core Functions, Systems, Processes, SOPs, Roles, Employees, Services, Membership
        </p>
      </div>

      <div className="px-4 border-b border-[#2e2016] flex items-end gap-0.5 overflow-x-auto bg-[#1a1410]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap
              transition-colors border-b-2 -mb-px
              ${activeTab === tab.key
                ? 'border-[#c8843a] text-[#c8843a]'
                : 'border-transparent text-[#6b5a47] hover:text-[#c4b49a] hover:border-[#2e2016]'}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <BizTable key={activeTab} tab={activeTab} orgId={orgId} />
      </div>
    </div>
  )
}

export default function BusinessMappingPage() {
  return (
    <RoleGuard allow={['admin']}>
      <BusinessMappingContent />
    </RoleGuard>
  )
}
