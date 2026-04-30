'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import {
  Search, SlidersHorizontal, Filter, ArrowUpDown, Group,
  Calendar, Download, Upload, RefreshCw, Plus, X,
  ChevronDown, ChevronUp, ChevronsUpDown,
  Check, Loader2, AlertCircle, User, Lightbulb,
  Briefcase, Link2, LayoutGrid
} from 'lucide-react'

type RowHeight = 'compact' | 'medium' | 'tall'
type SortConfig = { key: keyof Idea; dir: 'asc' | 'desc' } | null

type Idea = {
  id: string
  org_id: string
  idea_name: string
  submitted_by: string | null
  function: string | null
  status: string
  date_added: string | null
  description: string | null
  linked_project: string | null   // ← FK to projects.id
  created_at: string
}

const STATUS_OPTIONS  = ['Parked', 'Under Review', 'Approved', 'Rejected']
const FUNCTION_OPTIONS = [
  'Clinical Care', 'Patient Services', 'Patient Access & Front Desk',
  'Revenue Cycle & Finance', 'Operations', 'Marketing',
  'Human Resources & Staffing', 'Compliance', 'Leadership',
  'Legal & Risk', 'IT & Infrastructure',
  'Leadership & Strategic Growth', 'Quality Improvement & Maintenance'
]
const STATUS_COLORS: Record<string, string> = {
  'Parked':       'bg-[#1e1409] text-[#6b5a47]',
  'Under Review': 'bg-[#1a1a0f] text-[#facc15]',
  'Approved':     'bg-[#0f2318] text-[#86efac]',
  'Rejected':     'bg-[#2e1010] text-[#f87171]',
}

const DEMO: Idea[] = [
  { id: 'did-1', org_id: 'demo', idea_name: 'Add online appointment booking widget', submitted_by: null, function: 'Patient Access & Front Desk', status: 'Under Review', date_added: '2025-04-20', description: 'Patients could self-schedule routine visits through a widget on the practice website.', linked_project: null, created_at: new Date().toISOString() },
  { id: 'did-2', org_id: 'demo', idea_name: 'Weekly billing performance scorecard', submitted_by: null, function: 'Revenue Cycle & Finance', status: 'Approved', date_added: '2025-04-10', description: 'A one-page weekly report showing denial rate, claims submitted, and collection rate.', linked_project: null, created_at: new Date().toISOString() },
  { id: 'did-3', org_id: 'demo', idea_name: 'Patient re-engagement outreach for lapsed patients', submitted_by: null, function: 'Marketing', status: 'Parked', date_added: '2025-03-28', description: 'Identify patients not seen in 12+ months and send a re-engagement text.', linked_project: null, created_at: new Date().toISOString() },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SelectCell({ value, options, onSave, onCancel }: { value: string; options: string[]; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <select autoFocus defaultValue={value} onBlur={e => onSave(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()}
      className="w-full bg-[#120d08] border border-[#c8843a] text-[#c4b49a] text-xs rounded px-1 py-0.5 outline-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── New Idea Modal ───────────────────────────────────────────────────────────
function NewIdeaModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ idea_name: '', function: '', description: '', date_added: today, linked_project: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // ADDED: fetch projects for linked_project dropdown
  const [projects, setProjects] = useState<{ id: string; project_name: string }[]>([])
  useEffect(() => {
    supabase.from('projects').select('id, project_name').eq('org_id', orgId).order('project_name')
      .then(({ data }) => setProjects((data ?? []) as { id: string; project_name: string }[]))
  }, [orgId])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.idea_name.trim()) { setErr('Idea name is required.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('ideas').insert({
      org_id: orgId,
      idea_name: form.idea_name.trim(),
      status: 'Parked',
      function: form.function || null,
      description: form.description || null,
      date_added: form.date_added || today,
      linked_project: form.linked_project || null,  // ADDED
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
          <h2 className="text-[#c4b49a] font-semibold flex items-center gap-2"><Lightbulb size={15} className="text-[#facc15]" />Submit Idea</h2>
          <button onClick={onClose} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {err && <div className="flex items-center gap-2 text-[#f87171] text-xs bg-[#2e1010] border border-[#f87171]/20 rounded px-3 py-2"><AlertCircle size={13} />{err}</div>}
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Idea Name *</label>
            <input value={form.idea_name} onChange={e => set('idea_name', e.target.value)} placeholder="Short title for your idea…"
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Function / Area</label>
              <select value={form.function} onChange={e => set('function', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
                <option value="">— Select —</option>
                {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a08060] text-xs mb-1">Date Added</label>
              <input type="date" value={form.date_added} onChange={e => set('date_added', e.target.value)}
                className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[#a08060] text-xs mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What is this idea and why does it matter?" rows={4}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none resize-none" />
          </div>
          {/* ADDED: Linked Project */}
          <div>
            <label className="block text-[#a08060] text-xs mb-1">
              Linked Project <span className="text-[#6b5a47] font-normal">(if idea is already tied to a project)</span>
            </label>
            <select value={form.linked_project} onChange={e => set('linked_project', e.target.value)}
              className="w-full bg-[#120d08] border border-[#2e2016] focus:border-[#c8843a] text-[#c4b49a] text-sm rounded px-3 py-2 outline-none">
              <option value="">— None —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-[#6b5a47]">Ideas are submitted as Parked — a manager will review and approve or reject.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#2e2016]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b5a47] hover:text-[#c4b49a] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8843a] hover:bg-[#d4924a] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Submit Idea
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function IdeasPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { orgId, canViewAll } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId ?? undefined)
  const isManager = canViewAll

  // ADDED: project name map for resolving linked_project display
  const [projectMap, setProjectMap] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!orgId) return
    supabase.from('projects').select('id, project_name').eq('org_id', orgId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((r: { id: string; project_name: string }) => { map[r.id] = r.project_name })
        setProjectMap(map)
      })
  }, [orgId])

  const [search, setSearch]         = useState('')
  const [rowHeight, setRowHeight]   = useState<RowHeight>('medium')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date_added', dir: 'desc' })
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterFunction, setFilterFunction] = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow]           = useState<Idea | null>(null)
  const [showNewModal, setShowNewModal]     = useState(false)
  const [editStatusId, setEditStatusId]     = useState<string | null>(null)
  const [showFilters, setShowFilters]       = useState(false)

  const { data: ideas, isLoading, refetch } = useQuery<Idea[]>({
    queryKey: ['ideas', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ideas').select('*').eq('org_id', orgId!)
        .order('date_added', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Idea[]
    },
  })

  const rows   = ideas ?? (isLoading ? [] : DEMO)
  const isDemo = !ideas && !isLoading

  const patchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (isDemo) return
      const { error } = await supabase.from('ideas').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ideas', orgId] }),
  })

  const saveStatus = useCallback((id: string, status: string) => {
    patchStatus.mutate({ id, status })
    setEditStatusId(null)
    setDetailRow(prev => prev?.id === id ? { ...prev, status } as Idea : prev)
  }, [patchStatus])

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => x.idea_name.toLowerCase().includes(q) || (x.function ?? '').toLowerCase().includes(q) || (x.description ?? '').toLowerCase().includes(q))
    }
    if (filterStatus)   r = r.filter(x => x.status === filterStatus)
    if (filterFunction) r = r.filter(x => x.function === filterFunction)
    if (sortConfig) {
      const { key, dir } = sortConfig
      r = [...r].sort((a, b) => dir === 'asc'
        ? String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
        : String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
    }
    return r
  }, [rows, search, filterStatus, filterFunction, sortConfig])

  const total    = filtered.length
  const approved = filtered.filter(x => x.status === 'Approved').length
  const parked   = filtered.filter(x => x.status === 'Parked').length

  function toggleSort(key: keyof Idea) {
    setSortConfig(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: keyof Idea }) {
    if (sortConfig?.key !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortConfig.dir === 'asc' ? <ChevronUp size={11} className="text-[#c8843a]" /> : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  const rowPy = rowHeight === 'compact' ? 'py-1' : rowHeight === 'medium' ? 'py-2.5' : 'py-4'

  function exportCsv() {
    const headers = ['Idea', 'Status', 'Function', 'Date Added', 'Submitted By', 'Linked Project']
    const csv = [headers, ...filtered.map(r => [
      r.idea_name, r.status, r.function ?? '', r.date_added ?? '',
      r.submitted_by ? resolveName(r.submitted_by) : '',
      r.linked_project ? (projectMap[r.linked_project] ?? r.linked_project) : ''
    ])].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv]))
    a.download = 'ideas.csv'; a.click()
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a] flex items-center gap-2"><Lightbulb size={18} className="text-[#facc15]" />Ideas</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          {total} idea{total !== 1 ? 's' : ''} &nbsp;·&nbsp; <span className="text-[#86efac]">{approved} approved</span> &nbsp;·&nbsp; <span className="text-[#6b5a47]">{parked} parked</span>
          {isDemo && <span className="ml-2 text-[#fb923c]">(demo data)</span>}
        </p>
      </div>

      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-1.5 flex-wrap bg-[#1a1410]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ideas…"
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-8 pr-3 py-1.5 w-48 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <div className="w-px h-5 bg-[#2e2016] mx-0.5" />
        {[
          { icon: <SlidersHorizontal size={13} />, label: 'Fields' },
          { icon: <Filter size={13} />, label: 'Filter', onClick: () => setShowFilters(v => !v), active: showFilters || !!(filterStatus || filterFunction) },
          { icon: <ArrowUpDown size={13} />, label: 'Sort' },
          { icon: <Group size={13} />, label: 'Group' },
          { icon: <Calendar size={13} />, label: 'Date' },
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
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><Upload size={13} />Import</button>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors border border-transparent"><RefreshCw size={13} />Refresh</button>
        <div className="flex-1" />
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c8843a] hover:bg-[#d4924a] text-white text-xs font-medium rounded-lg transition-colors">
          <Plus size={13} />Submit Idea
        </button>
      </div>

      {showFilters && (
        <div className="px-4 py-2.5 border-b border-[#2e2016] bg-[#1e1409] flex items-center gap-3 flex-wrap">
          <span className="text-[#6b5a47] text-xs font-medium">Filters:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterFunction} onChange={e => setFilterFunction(e.target.value)}
            className="bg-[#120d08] border border-[#2e2016] text-[#c4b49a] text-xs rounded px-2 py-1 outline-none focus:border-[#c8843a]">
            <option value="">All Functions</option>
            {FUNCTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          {(filterStatus || filterFunction) && (
            <button onClick={() => { setFilterStatus(''); setFilterFunction('') }}
              className="flex items-center gap-1 text-xs text-[#f87171]"><X size={11} />Clear</button>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                <th className="pf-sticky-checkbox w-8 px-2 py-2">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                    className="accent-[#c8843a]" />
                </th>
                {[
                  { key: 'idea_name' as keyof Idea,    label: 'Idea',          icon: <Lightbulb size={11} />, w: 'min-w-[240px]' },
                  { key: 'status' as keyof Idea,       label: 'Status',        icon: <Check size={11} />, w: 'min-w-[120px]' },
                  { key: 'function' as keyof Idea,     label: 'Function',      icon: <Briefcase size={11} />, w: 'min-w-[160px]' },
                  { key: 'submitted_by' as keyof Idea, label: 'Submitted By',  icon: <User size={11} />, w: 'min-w-[130px]' },
                  { key: 'date_added' as keyof Idea,   label: 'Date Added',    icon: <Calendar size={11} />, w: 'min-w-[110px]' },
                  { key: 'linked_project' as keyof Idea,label:'Linked Project', icon: <Link2 size={11} />, w: 'min-w-[160px]' }, // ← ADDED
                  { key: 'description' as keyof Idea,  label: 'Description',   icon: <Lightbulb size={11} />, w: 'min-w-[240px]' },
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
                <tr><td colSpan={8} className="text-center py-16 text-[#6b5a47]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading ideas…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-[#6b5a47]">No ideas found.</td></tr>
              ) : filtered.map((row, idx) => {
                const selected = selectedIds.has(row.id)
                const isActive = detailRow?.id === row.id
                return (
                  <tr key={row.id} onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors ${selected ? 'pf-row-selected' : ''} ${isActive ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'} hover:bg-[#c8843a]/5`}>
                    <td className="pf-sticky-checkbox px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected}
                        onChange={e => { const next = new Set(selectedIds); e.target.checked ? next.add(row.id) : next.delete(row.id); setSelectedIds(next) }}
                        className="accent-[#c8843a]" />
                    </td>
                    <td className={`pf-sticky-cell px-3 ${rowPy} font-medium text-[#c4b49a]`} style={{ left: 32 }}>{row.idea_name}</td>
                    <td className={`px-3 ${rowPy}`} onDoubleClick={e => { e.stopPropagation(); if (isManager) setEditStatusId(row.id) }}>
                      {editStatusId === row.id && isManager ? (
                        <SelectCell value={row.status} options={STATUS_OPTIONS} onSave={v => saveStatus(row.id, v)} onCancel={() => setEditStatusId(null)} />
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status] ?? ''}`}>{row.status}</span>
                      )}
                    </td>
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`}>{row.function ?? <span className="text-[#6b5a47]">—</span>}</td>
                    <td className={`px-3 ${rowPy} text-[#a08060]`}>{row.submitted_by ? resolveName(row.submitted_by) : <span className="text-[#6b5a47]">—</span>}</td>
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap`}>{fmtDate(row.date_added)}</td>
                    {/* ADDED: linked project column */}
                    <td className={`px-3 ${rowPy} text-[#a08060] whitespace-nowrap max-w-[180px] truncate`}>
                      {row.linked_project ? (
                        <span className="flex items-center gap-1"><Link2 size={10} className="text-[#c8843a]" />{projectMap[row.linked_project] ?? '…'}</span>
                      ) : <span className="text-[#6b5a47]">—</span>}
                    </td>
                    <td className={`px-3 ${rowPy} text-[#6b5a47] max-w-[250px] truncate`}>{row.description ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#2e2016] bg-[#1e1409] sticky bottom-0 text-[#6b5a47]">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-[#a08060] font-medium">{filtered.length} ideas</td>
                  <td className="px-3 py-2"><span className="text-[#86efac] text-[10px]">{approved} approved</span>{' · '}<span className="text-[#6b5a47] text-[10px]">{parked} parked</span></td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {detailRow && (
          <div className="w-[380px] border-l border-[#2e2016] bg-[#1e1409] flex flex-col overflow-y-auto shrink-0">
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
              <div className="flex-1 pr-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5 ${STATUS_COLORS[detailRow.status] ?? ''}`}>{detailRow.status}</span>
                <h3 className="text-[#c4b49a] font-semibold text-sm leading-snug">{detailRow.idea_name}</h3>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors mt-0.5 shrink-0"><X size={16} /></button>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><User size={11} />Submitted By</p>
                  <p className="text-[#c4b49a]">{detailRow.submitted_by ? resolveName(detailRow.submitted_by) : <span className="text-[#6b5a47]">—</span>}</p>
                </div>
                <div>
                  <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Calendar size={11} />Date Added</p>
                  <p className="text-[#c4b49a]">{fmtDate(detailRow.date_added)}</p>
                </div>
              </div>
              <div>
                <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Briefcase size={11} />Function</p>
                <p className="text-[#a08060]">{detailRow.function ?? '—'}</p>
              </div>
              {/* ADDED: linked project in detail */}
              <div>
                <p className="text-[#6b5a47] mb-0.5 flex items-center gap-1"><Link2 size={11} />Linked Project</p>
                <p className="text-[#a08060]">
                  {detailRow.linked_project ? (projectMap[detailRow.linked_project] ?? detailRow.linked_project) : '—'}
                </p>
              </div>
              {detailRow.description && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-1.5 font-medium">Description</p>
                  <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{detailRow.description}</p>
                </div>
              )}
              {isManager && (
                <div className="border-t border-[#2e2016] pt-3">
                  <p className="text-[#6b5a47] mb-2 font-medium">Manager Decision</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s} onClick={() => saveStatus(detailRow.id, s)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${detailRow.status === s ? (STATUS_COLORS[s] ?? '') + ' ring-1 ring-white/20' : 'bg-[#120d08] text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {orgId && <div className="border-t border-[#2e2016] px-4 py-3"><RecordComments recordId={detailRow.id} tableName="ideas" orgId={orgId} /></div>}
            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto">
              <button onClick={() => setDetailRow(null)} className="w-full py-2 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016] hover:border-[#c8843a]/30 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        )}
      </div>

      {showNewModal && orgId && (
        <NewIdeaModal orgId={orgId} onClose={() => setShowNewModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['ideas', orgId] })} />
      )}

      <div className="px-4 py-1.5 border-t border-[#2e2016] bg-[#1a1410]">
        <p className="text-[10px] text-[#6b5a47]">Anyone can submit ideas · Click row to view · {isManager ? 'Double-click Status or use panel buttons to approve/reject' : 'Managers review and approve ideas'}</p>
      </div>
    </div>
  )
}