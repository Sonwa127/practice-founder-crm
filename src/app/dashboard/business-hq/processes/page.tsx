'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

type ProcessStatus = 'Started' | 'Active' | 'To Improve' | 'Excellent' | 'Not Started' | 'Inactive'

interface Process {
  id: string
  org_id: string
  name: string
  status: ProcessStatus
  purpose: string | null
  process_detail: string | null
  linked_system_id: string | null
  created_at: string
  systems?: { name: string } | null
}

const STATUS_OPTIONS: ProcessStatus[] = ['Not Started', 'Started', 'Active', 'To Improve', 'Excellent', 'Inactive']

const STATUS_STYLE: Record<ProcessStatus, string> = {
  'Not Started': 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40',
  'Started':     'bg-blue-900/30 text-blue-300 border border-blue-700/40',
  'Active':      'bg-green-900/30 text-green-300 border border-green-700/40',
  'To Improve':  'bg-amber-900/30 text-amber-300 border border-amber-700/40',
  'Excellent':   'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40',
  'Inactive':    'bg-red-900/20 text-red-400 border border-red-700/30',
}

export default function ProcessesPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin', 'member']}>
      <ProcessesContent />
    </RoleGuard>
  )
}

function ProcessesContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProcessStatus | 'All'>('All')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = { name: '', status: 'Not Started' as ProcessStatus, purpose: '', process_detail: '', linked_system_id: '' }
  const [form, setForm] = useState(emptyForm)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['processes', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select('*, systems(name)')
        .eq('org_id', orgId!)
        .order('name')
      if (error) throw error
      return data as Process[]
    },
  })

  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('systems').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['processes', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('processes').insert({ org_id: orgId, name: p.name, status: p.status, purpose: p.purpose || null, process_detail: p.process_detail || null, linked_system_id: p.linked_system_id || null })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from('processes').update({ [field]: value || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('processes').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const startEdit = useCallback((id: string, field: string, current: string) => { setEditingId(id); setEditField(field); setEditValue(current ?? '') }, [])
  const commitEdit = useCallback(() => { if (!editingId || !editField) return; updateMutation.mutate({ id: editingId, field: editField, value: editValue }) }, [editingId, editField, editValue, updateMutation])

  const filtered = items.filter(i => {
    const ms = i.name.toLowerCase().includes(search.toLowerCase())
    const mf = statusFilter === 'All' || i.status === statusFilter
    return ms && mf
  })
  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Business HQ</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Processes</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">The component steps that make up each system</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">+ New Process</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search processes…" className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ProcessStatus | 'All')} className="px-3 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selectedIds.size > 0 && <button onClick={() => setConfirmDelete([...selectedIds])} className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">Delete ({selectedIds.size})</button>}
      </div>

      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(filtered.map(i => i.id))); else setSelectedIds(new Set()) }} className="w-4 h-4 accent-[#c8843a]" /></th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Process Name</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Status</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">System</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-[#c4b49a]/40 text-sm">No processes yet.</td></tr>
            ) : filtered.map(item => (
              <>
                <tr key={item.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === item.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(item.id) : n.delete(item.id); setSelectedIds(n) }} className="w-4 h-4 accent-[#c8843a]" /></td>
                  <td className="p-3">
                    <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors">
                      <svg className={`w-4 h-4 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </td>
                  <td className="p-3">
                    {editingId === item.id && editField === 'name' ? (
                      <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}} className="w-full bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none" />
                    ) : (
                      <span className="text-[#c4b49a] cursor-pointer hover:text-[#c8843a] transition-colors font-medium" onClick={() => startEdit(item.id, 'name', item.name)}>{item.name}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === item.id && editField === 'status' ? (
                      <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-xs focus:outline-none">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${STATUS_STYLE[item.status]}`} onClick={() => startEdit(item.id, 'status', item.status)}>{item.status}</span>
                    )}
                  </td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs">{item.systems?.name ?? '—'}</td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs max-w-xs truncate">{item.purpose ?? '—'}</td>
                </tr>

                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={6} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-5">
                          {[
                            { label: 'Process Name', field: 'name', value: item.name, multiline: false },
                            { label: 'Purpose', field: 'purpose', value: item.purpose, multiline: true },
                            { label: 'Process Detail', field: 'process_detail', value: item.process_detail, multiline: true },
                          ].map(f => (
                            <div key={f.field}>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                              {editingId === item.id && editField === f.field ? (
                                f.multiline
                                  ? <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} rows={3} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none" />
                                  : <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none" />
                              ) : (
                                <p className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed" onClick={() => startEdit(item.id, f.field, f.value ?? '')}>
                                  {f.value || <span className="text-[#c4b49a]/30 italic">Click to add…</span>}
                                </p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Linked System</p>
                            {editingId === item.id && editField === 'linked_system_id' ? (
                              <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none">
                                <option value="">— None —</option>
                                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            ) : (
                              <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(item.id, 'linked_system_id', item.linked_system_id ?? '')}>
                                {item.systems?.name ?? <span className="text-[#c4b49a]/30 italic">None</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <div><RecordComments orgId={orgId} recordId={item.id} tableName="processes" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([item.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete process</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {filtered.length} of {items.length} processes</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New Process</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Process Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ProcessStatus }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Linked System</label>
              <select value={form.linked_system_id} onChange={e => setForm(p => ({ ...p, linked_system_id: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
                <option value="">— None —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Purpose</label><textarea value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} rows={2} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" /></div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Process Detail</label><textarea value={form.process_detail} onChange={e => setForm(p => ({ ...p, process_detail: e.target.value }))} rows={3} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => { if (form.name.trim()) createMutation.mutate(form) }} disabled={!form.name.trim() || createMutation.isPending} className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">{createMutation.isPending ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this process' : `${confirmDelete.length} processes`}? This cannot be undone.</p>
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