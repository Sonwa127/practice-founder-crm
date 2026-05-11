'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface System {
  id: string
  org_id: string
  name: string
  objective: string | null
  linked_core_function_id: string | null
  created_at: string
  core_functions?: { name: string } | null
}

export default function SystemsPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin', 'member']}>
      <SystemsContent />
    </RoleGuard>
  )
}

function SystemsContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = { name: '', objective: '', linked_core_function_id: '' }
  const [form, setForm] = useState(emptyForm)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['systems', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('systems')
        .select('*, core_functions(name)')
        .eq('org_id', orgId!)
        .order('name')
      if (error) throw error
      return data as System[]
    },
  })

  const { data: coreFunctions = [] } = useQuery({
    queryKey: ['core-functions-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('core_functions').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['systems', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('systems').insert({ org_id: orgId, name: p.name, objective: p.objective || null, linked_core_function_id: p.linked_core_function_id || null })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from('systems').update({ [field]: value || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('systems').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const startEdit = useCallback((id: string, field: string, current: string) => {
    setEditingId(id); setEditField(field); setEditValue(current ?? '')
  }, [])
  const commitEdit = useCallback(() => {
    if (!editingId || !editField) return
    updateMutation.mutate({ id: editingId, field: editField, value: editValue })
  }, [editingId, editField, editValue, updateMutation])

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))

  if (userLoading || isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Business HQ</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Systems</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">The systems through which each core function is delivered</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">+ New System</button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search systems…" className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50" />
        </div>
        {selectedIds.size > 0 && <button onClick={() => setConfirmDelete([...selectedIds])} className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">Delete ({selectedIds.size})</button>}
      </div>

      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(filtered.map(i => i.id))); else setSelectedIds(new Set()) }} className="w-4 h-4 accent-[#c8843a]" /></th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">System Name</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Core Function</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Objective</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-[#c4b49a]/40 text-sm">No systems yet. Add the first one.</td></tr>
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
                  <td className="p-3 text-[#c4b49a]/60 text-xs">{item.core_functions?.name ?? '—'}</td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs max-w-xs truncate">{item.objective ?? '—'}</td>
                </tr>

                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={5} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-5">
                          {[
                            { label: 'System Name', field: 'name', value: item.name, multiline: false },
                            { label: 'Objective', field: 'objective', value: item.objective, multiline: true },
                          ].map(f => (
                            <div key={f.field}>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                              {editingId === item.id && editField === f.field ? (
                                f.multiline ? (
                                  <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} rows={3} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none" />
                                ) : (
                                  <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none" />
                                )
                              ) : (
                                <p className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed" onClick={() => startEdit(item.id, f.field, f.value ?? '')}>
                                  {f.value || <span className="text-[#c4b49a]/30 italic">Click to add…</span>}
                                </p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Core Function</p>
                            {editingId === item.id && editField === 'linked_core_function_id' ? (
                              <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none">
                                <option value="">— None —</option>
                                {coreFunctions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            ) : (
                              <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(item.id, 'linked_core_function_id', item.linked_core_function_id ?? '')}>
                                {item.core_functions?.name ?? <span className="text-[#c4b49a]/30 italic">None</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <div><RecordComments orgId={orgId} recordId={item.id} tableName="systems" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([item.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete system</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {filtered.length} of {items.length} systems</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New System</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">System Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Core Function</label>
              <select value={form.linked_core_function_id} onChange={e => setForm(p => ({ ...p, linked_core_function_id: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50">
                <option value="">— None —</option>
                {coreFunctions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Objective</label>
              <textarea value={form.objective} onChange={e => setForm(p => ({ ...p, objective: e.target.value }))} rows={3} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" />
            </div>
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
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this system' : `${confirmDelete.length} systems`}? This cannot be undone.</p>
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