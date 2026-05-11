'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliverableStatus = 'In Process' | 'In Review' | 'Complete'

interface Deliverable {
  id: string
  org_id: string
  deliverable_name: string
  date_submitted: string | null
  submitted_by: string | null
  status: DeliverableStatus
  deliverable_content: string | null
  description: string | null
  linked_task_id: string | null
  created_at: string
  tasks?: { task_title: string } | null
}

interface Task {
  id: string
  task_title: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: DeliverableStatus[] = ['In Process', 'In Review', 'Complete']

const STATUS_STYLE: Record<DeliverableStatus, string> = {
  'In Process':  'bg-blue-900/30 text-blue-300 border border-blue-700/40',
  'In Review':   'bg-amber-900/30 text-amber-300 border border-amber-700/40',
  'Complete':    'bg-green-900/30 text-green-300 border border-green-700/40',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeliverablesPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin', 'member']}>
      <DeliverablesContent />
    </RoleGuard>
  )
}

function DeliverablesContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, employeeId, canViewAll, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliverableStatus | 'All'>('All')
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editField, setEditField]     = useState<string | null>(null)
  const [editValue, setEditValue]     = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────
  const emptyForm = {
    deliverable_name: '',
    date_submitted: new Date().toISOString().slice(0, 10),
    submitted_by: employeeId ?? '',
    status: 'In Process' as DeliverableStatus,
    deliverable_content: '',
    description: '',
    linked_task_id: '',
  }
  const [form, setForm] = useState(emptyForm)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: deliverables = [], isLoading } = useQuery({
    queryKey: ['deliverables', orgId, canViewAll, employeeId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('deliverables')
        .select('*, tasks(task_title)')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })

      if (!canViewAll && employeeId) {
        q = q.eq('submitted_by', employeeId)
      }
      const { data, error } = await q
      if (error) throw error
      return data as Deliverable[]
    },
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, task_title')
        .eq('org_id', orgId!)
        .order('task_title')
      if (error) throw error
      return data as Task[]
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .eq('org_id', orgId!)
        .order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['deliverables', orgId] })

  const createMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      const { error } = await supabase.from('deliverables').insert({
        org_id: orgId,
        deliverable_name: payload.deliverable_name,
        date_submitted: payload.date_submitted || null,
        submitted_by: payload.submitted_by || null,
        status: payload.status,
        deliverable_content: payload.deliverable_content || null,
        description: payload.description || null,
        linked_task_id: payload.linked_task_id || null,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase
        .from('deliverables')
        .update({ [field]: value || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('deliverables').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = deliverables.filter(d => {
    const matchSearch = d.deliverable_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const allSelected = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id))

  // ── Inline edit helpers ───────────────────────────────────────────────────
  const startEdit = useCallback((id: string, field: string, current: string) => {
    setEditingId(id); setEditField(field); setEditValue(current ?? '')
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingId || !editField) return
    updateMutation.mutate({ id: editingId, field: editField, value: editValue })
  }, [editingId, editField, editValue, updateMutation])

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = {
    total:     deliverables.length,
    inProcess: deliverables.filter(d => d.status === 'In Process').length,
    inReview:  deliverables.filter(d => d.status === 'In Review').length,
    complete:  deliverables.filter(d => d.status === 'Complete').length,
  }

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Task Management</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Deliverables</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Outputs and documents produced from completed tasks</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ ...emptyForm, submitted_by: employeeId ?? '' }) }}
          className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Deliverable
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: counts.total,     color: 'text-[#c4b49a]' },
          { label: 'In Process', value: counts.inProcess, color: 'text-blue-400'  },
          { label: 'In Review',  value: counts.inReview,  color: 'text-amber-400' },
          { label: 'Complete',   value: counts.complete,  color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1f1a14] border border-[#2e2016] rounded-xl p-4">
            <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search deliverables..."
            className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DeliverableStatus | 'All')}
          className="px-3 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setConfirmDelete([...selectedIds])}
            className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors"
          >
            Delete ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(d => d.id)))
                    else setSelectedIds(new Set())
                  }}
                  className="w-4 h-4 accent-[#c8843a]"
                />
              </th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Deliverable</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Status</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Submitted By</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Date</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Linked Task</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-[#c4b49a]/40 text-sm">
                  {search || statusFilter !== 'All' ? 'No deliverables match your filters.' : 'No deliverables yet. Create the first one.'}
                </td>
              </tr>
            ) : filtered.map(d => (
              <>
                <tr
                  key={d.id}
                  className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === d.id ? 'bg-[#2a1f14]/40' : ''}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={e => {
                        const next = new Set(selectedIds)
                        e.target.checked ? next.add(d.id) : next.delete(d.id)
                        setSelectedIds(next)
                      }}
                      className="w-4 h-4 accent-[#c8843a]"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                      className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedId === d.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </td>
                  {/* Name — inline edit */}
                  <td className="p-3">
                    {editingId === d.id && editField === 'deliverable_name' ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}}
                        className="w-full bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-[#c4b49a] cursor-pointer hover:text-[#c8843a] transition-colors font-medium"
                        onClick={() => startEdit(d.id, 'deliverable_name', d.deliverable_name)}
                      >
                        {d.deliverable_name}
                      </span>
                    )}
                  </td>
                  {/* Status — inline select */}
                  <td className="p-3">
                    {editingId === d.id && editField === 'status' ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-xs focus:outline-none"
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${STATUS_STYLE[d.status]}`}
                        onClick={() => startEdit(d.id, 'status', d.status)}
                      >
                        {d.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">{resolveName(d.submitted_by)}</td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">{fmt(d.date_submitted)}</td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs">
                    {d.tasks?.task_title ?? '—'}
                  </td>
                </tr>

                {/* Expanded detail panel */}
                {expandedId === d.id && (
                  <tr key={`${d.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={7} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        {/* Left col */}
                        <div className="space-y-5">
                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Description</p>
                            {editingId === d.id && editField === 'description' ? (
                              <textarea
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                rows={3}
                                className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none"
                              />
                            ) : (
                              <p
                                className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed"
                                onClick={() => startEdit(d.id, 'description', d.description ?? '')}
                              >
                                {d.description || <span className="text-[#c4b49a]/30 italic">Click to add description…</span>}
                              </p>
                            )}
                          </div>

                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Deliverable Content / Link</p>
                            {editingId === d.id && editField === 'deliverable_content' ? (
                              <textarea
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                rows={4}
                                className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none"
                              />
                            ) : (
                              <p
                                className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed break-all"
                                onClick={() => startEdit(d.id, 'deliverable_content', d.deliverable_content ?? '')}
                              >
                                {d.deliverable_content
                                  ? (d.deliverable_content.startsWith('http')
                                    ? <a href={d.deliverable_content} target="_blank" rel="noopener noreferrer" className="text-[#c8843a] underline">{d.deliverable_content}</a>
                                    : d.deliverable_content)
                                  : <span className="text-[#c4b49a]/30 italic">Click to add content or paste a link…</span>}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Submitted By</p>
                              {editingId === d.id && editField === 'submitted_by' ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none"
                                >
                                  <option value="">— Select —</option>
                                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                              ) : (
                                <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(d.id, 'submitted_by', d.submitted_by ?? '')}>
                                  {resolveName(d.submitted_by)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Linked Task</p>
                              {editingId === d.id && editField === 'linked_task_id' ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none"
                                >
                                  <option value="">— None —</option>
                                  {tasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
                                </select>
                              ) : (
                                <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(d.id, 'linked_task_id', d.linked_task_id ?? '')}>
                                  {d.tasks?.task_title ?? <span className="text-[#c4b49a]/30 italic">None</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right col — comments */}
                        <div>
                          <RecordComments orgId={orgId} recordId={d.id} tableName="deliverables" />
                        </div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button
                          onClick={() => setConfirmDelete([d.id])}
                          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          Delete deliverable
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">
            Showing {filtered.length} of {deliverables.length} deliverables
          </div>
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New Deliverable</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {[
              { label: 'Deliverable Name *', key: 'deliverable_name', type: 'text' },
              { label: 'Date Submitted', key: 'date_submitted', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Submitted By</label>
              <select
                value={form.submitted_by}
                onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))}
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"
              >
                <option value="">— Select employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as DeliverableStatus }))}
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Linked Task</label>
              <select
                value={form.linked_task_id}
                onChange={e => setForm(p => ({ ...p, linked_task_id: e.target.value }))}
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"
              >
                <option value="">— None —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Deliverable Content / Link</label>
              <textarea
                value={form.deliverable_content}
                onChange={e => setForm(p => ({ ...p, deliverable_content: e.target.value }))}
                rows={3}
                placeholder="Paste a link or describe the output…"
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:border-[#c8843a]/40 hover:text-[#c4b49a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (form.deliverable_name.trim()) createMutation.mutate(form) }}
                disabled={!form.deliverable_name.trim() || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">
              Delete {confirmDelete.length === 1 ? 'this deliverable' : `${confirmDelete.length} deliverables`}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}