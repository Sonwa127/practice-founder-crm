'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

type SOPStatus = 'Started' | 'Active' | 'To Improve' | 'Excellent' | 'Not Started' | 'Inactive'

interface SOP {
  id: string
  org_id: string
  name: string
  status: SOPStatus
  purpose: string | null
  resources_needed: string | null
  input_trigger: string | null
  steps: string | null
  how_we_know_complete: string | null
  faqs: string | null
  linked_process_id: string | null
  created_at: string
  processes?: { name: string } | null
}

const STATUS_OPTIONS: SOPStatus[] = ['Not Started', 'Started', 'Active', 'To Improve', 'Excellent', 'Inactive']
const STATUS_STYLE: Record<SOPStatus, string> = {
  'Not Started': 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40',
  'Started':     'bg-blue-900/30 text-blue-300 border border-blue-700/40',
  'Active':      'bg-green-900/30 text-green-300 border border-green-700/40',
  'To Improve':  'bg-amber-900/30 text-amber-300 border border-amber-700/40',
  'Excellent':   'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40',
  'Inactive':    'bg-red-900/20 text-red-400 border border-red-700/30',
}

export default function SOPsPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin', 'member']}>
      <SOPsContent />
    </RoleGuard>
  )
}

function SOPsContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SOPStatus | 'All'>('All')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = { name: '', status: 'Not Started' as SOPStatus, purpose: '', resources_needed: '', input_trigger: '', steps: '', how_we_know_complete: '', faqs: '', linked_process_id: '' }
  const [form, setForm] = useState(emptyForm)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sops', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('sops').select('*, processes(name)').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as SOP[]
    },
  })

  const { data: processes = [] } = useQuery({
    queryKey: ['processes-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('processes').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sops', orgId] })
  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('sops').insert({ org_id: orgId, name: p.name, status: p.status, purpose: p.purpose || null, resources_needed: p.resources_needed || null, input_trigger: p.input_trigger || null, steps: p.steps || null, how_we_know_complete: p.how_we_know_complete || null, faqs: p.faqs || null, linked_process_id: p.linked_process_id || null })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from('sops').update({ [field]: value || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('sops').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const startEdit = useCallback((id: string, field: string, current: string) => { setEditingId(id); setEditField(field); setEditValue(current ?? '') }, [])
  const commitEdit = useCallback(() => { if (!editingId || !editField) return; updateMutation.mutate({ id: editingId, field: editField, value: editValue }) }, [editingId, editField, editValue, updateMutation])

  const filtered = items.filter(i => (i.name.toLowerCase().includes(search.toLowerCase())) && (statusFilter === 'All' || i.status === statusFilter))
  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  const detailFields = [
    { label: 'SOP Name', field: 'name', value: (i: SOP) => i.name, multiline: false },
    { label: 'Purpose', field: 'purpose', value: (i: SOP) => i.purpose, multiline: true },
    { label: 'Resources Needed', field: 'resources_needed', value: (i: SOP) => i.resources_needed, multiline: true },
    { label: 'Input / Trigger', field: 'input_trigger', value: (i: SOP) => i.input_trigger, multiline: true },
    { label: 'Steps', field: 'steps', value: (i: SOP) => i.steps, multiline: true },
    { label: 'How We Know It\'s Complete', field: 'how_we_know_complete', value: (i: SOP) => i.how_we_know_complete, multiline: true },
    { label: 'FAQs', field: 'faqs', value: (i: SOP) => i.faqs, multiline: true },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Business HQ</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">SOPs</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Standard Operating Procedures for executing key processes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">+ New SOP</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SOPs…" className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SOPStatus | 'All')} className="px-3 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
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
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">SOP Name</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Status</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Process</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-[#c4b49a]/40 text-sm">No SOPs yet. Add the first one.</td></tr>
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
                  <td className="p-3 text-[#c4b49a]/60 text-xs">{item.processes?.name ?? '—'}</td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs max-w-xs truncate">{item.purpose ?? '—'}</td>
                </tr>

                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={6} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-5">
                          {detailFields.map(f => (
                            <div key={f.field}>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                              {editingId === item.id && editField === f.field ? (
                                f.multiline
                                  ? <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} rows={f.field === 'steps' ? 6 : 3} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none" />
                                  : <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none" />
                              ) : (
                                <p className={`text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed ${f.field === 'steps' ? 'whitespace-pre-wrap' : ''}`} onClick={() => startEdit(item.id, f.field, f.value(item) ?? '')}>
                                  {f.value(item) || <span className="text-[#c4b49a]/30 italic">Click to add…</span>}
                                </p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Linked Process</p>
                            {editingId === item.id && editField === 'linked_process_id' ? (
                              <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none">
                                <option value="">— None —</option>
                                {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            ) : (
                              <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(item.id, 'linked_process_id', item.linked_process_id ?? '')}>
                                {item.processes?.name ?? <span className="text-[#c4b49a]/30 italic">None</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <div><RecordComments orgId={orgId} recordId={item.id} tableName="sops" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([item.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete SOP</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {filtered.length} of {items.length} SOPs</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New SOP</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            {[
              { label: 'SOP Name *', key: 'name', type: 'input' },
            ].map(f => (
              <div key={f.key}><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label><input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
            ))}
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Status</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as SOPStatus }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Linked Process</label><select value={form.linked_process_id} onChange={e => setForm(p => ({ ...p, linked_process_id: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"><option value="">— None —</option>{processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            {[
              { label: 'Purpose', key: 'purpose' },
              { label: 'Resources Needed', key: 'resources_needed' },
              { label: 'Input / Trigger', key: 'input_trigger' },
              { label: 'Steps', key: 'steps' },
              { label: 'How We Know It\'s Complete', key: 'how_we_know_complete' },
              { label: 'FAQs', key: 'faqs' },
            ].map(f => (
              <div key={f.key}><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label><textarea value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={f.key === 'steps' ? 4 : 2} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" /></div>
            ))}
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
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this SOP' : `${confirmDelete.length} SOPs`}? This cannot be undone.</p>
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