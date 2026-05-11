'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface Employee {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  linked_role_id: string | null
  dashboard_access: boolean
  financials_access: boolean
  created_at: string
  roles?: { name: string } | null
}

export default function EmployeesPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin']}>
      <EmployeesContent />
    </RoleGuard>
  )
}

function EmployeesContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = { name: '', email: '', phone: '', linked_role_id: '', dashboard_access: false, financials_access: false }
  const [form, setForm] = useState(emptyForm)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['employees', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*, roles(name)').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as Employee[]
    },
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['employees', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('employees').insert({ org_id: orgId, name: p.name, email: p.email || null, phone: p.phone || null, linked_role_id: p.linked_role_id || null, dashboard_access: p.dashboard_access, financials_access: p.financials_access })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from('employees').update({ [field]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('employees').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  const startEdit = useCallback((id: string, field: string, current: string) => { setEditingId(id); setEditField(field); setEditValue(current ?? '') }, [])
  const commitEdit = useCallback(() => {
    if (!editingId || !editField) return
    updateMutation.mutate({ id: editingId, field: editField, value: editValue || null })
  }, [editingId, editField, editValue, updateMutation])

  const toggleBool = (id: string, field: string, current: boolean) => {
    updateMutation.mutate({ id, field, value: !current })
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.email ?? '').toLowerCase().includes(search.toLowerCase()))
  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))

  if (userLoading || isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Business HQ</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Employees</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Everyone in the practice — used as lookup across all tables</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors">+ New Employee</button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50" />
        </div>
        {selectedIds.size > 0 && <button onClick={() => setConfirmDelete([...selectedIds])} className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">Delete ({selectedIds.size})</button>}
      </div>

      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(filtered.map(i => i.id))); else setSelectedIds(new Set()) }} className="w-4 h-4 accent-[#c8843a]" /></th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Name</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Role</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Email</th>
              <th className="p-3 text-center text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Dashboard</th>
              <th className="p-3 text-center text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Financials</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-[#c4b49a]/40 text-sm">No employees yet.</td></tr>
            ) : filtered.map(item => (
              <>
                <tr key={item.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === item.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(item.id) : n.delete(item.id); setSelectedIds(n) }} className="w-4 h-4 accent-[#c8843a]" /></td>
                  <td className="p-3"><button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors"><svg className={`w-4 h-4 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button></td>
                  <td className="p-3">
                    {editingId === item.id && editField === 'name' ? (
                      <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit() }} className="w-full bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none" />
                    ) : (
                      <span className="text-[#c4b49a] cursor-pointer hover:text-[#c8843a] font-medium" onClick={() => startEdit(item.id, 'name', item.name)}>{item.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">{item.roles?.name ?? '—'}</td>
                  <td className="p-3 text-[#c4b49a]/60 text-xs">{item.email ?? '—'}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleBool(item.id, 'dashboard_access', item.dashboard_access)} className={`w-9 h-5 rounded-full transition-colors ${item.dashboard_access ? 'bg-[#c8843a]' : 'bg-[#2e2016]'}`}>
                      <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${item.dashboard_access ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleBool(item.id, 'financials_access', item.financials_access)} className={`w-9 h-5 rounded-full transition-colors ${item.financials_access ? 'bg-[#c8843a]' : 'bg-[#2e2016]'}`}>
                      <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${item.financials_access ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                </tr>

                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={7} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-5">
                          {[
                            { label: 'Full Name', field: 'name', value: item.name },
                            { label: 'Email', field: 'email', value: item.email },
                            { label: 'Phone Number', field: 'phone', value: item.phone },
                          ].map(f => (
                            <div key={f.field}>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                              {editingId === item.id && editField === f.field ? (
                                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit() }} className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none" />
                              ) : (
                                <p className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a]" onClick={() => startEdit(item.id, f.field, f.value ?? '')}>
                                  {f.value || <span className="text-[#c4b49a]/30 italic">Click to add…</span>}
                                </p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">Role</p>
                            {editingId === item.id && editField === 'linked_role_id' ? (
                              <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} className="bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none">
                                <option value="">— None —</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            ) : (
                              <p className="text-sm text-[#c4b49a] cursor-pointer hover:text-[#c8843a]" onClick={() => startEdit(item.id, 'linked_role_id', item.linked_role_id ?? '')}>
                                {item.roles?.name ?? <span className="text-[#c4b49a]/30 italic">None</span>}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-6">
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-2">Dashboard Access</p>
                              <button onClick={() => toggleBool(item.id, 'dashboard_access', item.dashboard_access)} className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${item.dashboard_access ? 'bg-[#c8843a]' : 'bg-[#2e2016]'}`}>
                                <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${item.dashboard_access ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-2">Financials Access</p>
                              <button onClick={() => toggleBool(item.id, 'financials_access', item.financials_access)} className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${item.financials_access ? 'bg-[#c8843a]' : 'bg-[#2e2016]'}`}>
                                <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${item.financials_access ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div><RecordComments orgId={orgId} recordId={item.id} tableName="employees" /></div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([item.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete employee</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">Showing {filtered.length} of {items.length} employees</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#c4b49a]">New Employee</h2><button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button></div>
            {[{ label: 'Full Name *', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' }].map(f => (
              <div key={f.key}><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">{f.label}</label><input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" /></div>
            ))}
            <div><label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Role</label><select value={form.linked_role_id} onChange={e => setForm(p => ({ ...p, linked_role_id: e.target.value }))} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50"><option value="">— None —</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.dashboard_access} onChange={e => setForm(p => ({ ...p, dashboard_access: e.target.checked }))} className="w-4 h-4 accent-[#c8843a]" /><span className="text-sm text-[#c4b49a]/70">Dashboard Access</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.financials_access} onChange={e => setForm(p => ({ ...p, financials_access: e.target.checked }))} className="w-4 h-4 accent-[#c8843a]" /><span className="text-sm text-[#c4b49a]/70">Financials Access</span></label>
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
            <p className="text-sm text-[#c4b49a]/70">Delete {confirmDelete.length === 1 ? 'this employee' : `${confirmDelete.length} employees`}? This cannot be undone.</p>
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