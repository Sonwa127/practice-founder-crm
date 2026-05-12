'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import { Plus, ChevronDown, ChevronUp, Search, X, Trash2 } from 'lucide-react'

interface Employee {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  linked_role_id: string | null
  dashboard_access: boolean
  financials_access: boolean
  roles?: { name: string }
}

interface Role { id: string; name: string }

const emptyForm = {
  name: '', email: '', phone: '', linked_role_id: '',
  dashboard_access: false, financials_access: false,
}

const iCls = "w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a] transition-colors"
const lCls = "block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1"

export default function EmployeesPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [showForm, setShowForm]           = useState(false)
  const [editId, setEditId]               = useState<string | null>(null)
  const [form, setForm]                   = useState(emptyForm)
  const [search, setSearch]               = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['employees', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees').select('*, roles(name)').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as Employee[]
    },
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles').select('id, name').eq('org_id', orgId!).order('name')
      if (error) throw error
      return data as Role[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['employees', orgId] })

  const saveMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      const payload = {
        org_id: orgId,
        name: f.name,
        email: f.email || null,
        phone: f.phone || null,
        linked_role_id: f.linked_role_id || null,
        dashboard_access: f.dashboard_access,
        financials_access: f.financials_access,
      }
      if (editId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('employees').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); setConfirmDelete(null) },
  })

  function openEdit(item: Employee) {
    setForm({
      name: item.name, email: item.email ?? '', phone: item.phone ?? '',
      linked_role_id: item.linked_role_id ?? '',
      dashboard_access: item.dashboard_access,
      financials_access: item.financials_access,
    })
    setEditId(item.id)
    setShowForm(true)
  }

  const filtered = items.filter(i =>
    !search ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))

  if (userLoading || isLoading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-14 bg-[#1e1810] rounded-xl animate-pulse border border-[#2e2016]" />)}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-0.5">Business HQ</p>
          <h1 className="text-xl font-bold text-white">Employees</h1>
          <p className="text-xs text-[#c4b49a]/60 mt-0.5">Directory of all staff. Used across every Submitted By and Assigned To field.</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-[#c8843a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#d4944a] transition-colors self-start sm:self-auto">
          <Plus className="w-4 h-4" />New Employee
        </button>
      </div>

      {/* Search + bulk delete */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
            className="w-full pl-9 pr-8 py-2 bg-[#221710] border border-[#3a2a1a] rounded-lg text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition-colors" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-[#6b5a47]" /></button>}
        </div>
        {selectedIds.size > 0 && (
          <button onClick={() => setConfirmDelete([...selectedIds])}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-800/40 rounded-lg px-3 py-2 hover:bg-red-950/30 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />Delete ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-[#c8843a]/30 rounded-xl bg-[#1e1810] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{editId ? 'Edit Employee' : 'New Employee'}</h2>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="text-[#c4b49a]/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lCls}>Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Michael Johnson" className={iCls} />
            </div>
            <div>
              <label className={lCls}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="michael@practice.com" className={iCls} />
            </div>
            <div>
              <label className={lCls}>Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 000 0000" className={iCls} />
            </div>
            <div>
              <label className={lCls}>Linked Role</label>
              <select value={form.linked_role_id} onChange={e => setForm(p => ({ ...p, linked_role_id: e.target.value }))} className={iCls}>
                <option value="">— None —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.dashboard_access}
                  onChange={e => setForm(p => ({ ...p, dashboard_access: e.target.checked }))}
                  className="accent-[#c8843a]" />
                <span className="text-sm text-[#c4b49a]">Dashboard Access</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.financials_access}
                  onChange={e => setForm(p => ({ ...p, financials_access: e.target.checked }))}
                  className="accent-[#c8843a]" />
                <span className="text-sm text-[#c4b49a]">Financials Access</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}
              className="flex-1 bg-[#c8843a] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#d4944a] disabled:opacity-50 transition-colors">
              {saveMutation.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Create Employee'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-5 bg-[#2e2016] text-[#c4b49a] rounded-lg text-sm hover:bg-[#3a2a1a] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1e1810] border border-[#2e2016] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e2016]">
                <th className="p-3 w-10">
                  <input type="checkbox" checked={allSelected}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(i => i.id)) : new Set())}
                    className="accent-[#c8843a]" />
                </th>
                <th className="p-3 w-8" />
                {['Name','Email','Phone','Role','Dashboard','Financials'].map(h => (
                  <th key={h} className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-[#c4b49a]/40 text-sm">
                  {search ? 'No employees match your search.' : 'No employees yet. Add the first one.'}
                </td></tr>
              ) : filtered.map(item => (
                <>
                  <tr key={item.id}
                    className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === item.id ? 'bg-[#2a1f14]/40' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(item.id)}
                        onChange={e => {
                          const n = new Set(selectedIds)
                          e.target.checked ? n.add(item.id) : n.delete(item.id)
                          setSelectedIds(n)
                        }} className="accent-[#c8843a]" />
                    </td>
                    <td className="p-3">
                      <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors">
                        {expandedId === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-3 font-medium text-white">{item.name}</td>
                    <td className="p-3 text-[#c4b49a]/70">{item.email ?? '—'}</td>
                    <td className="p-3 text-[#c4b49a]/70">{item.phone ?? '—'}</td>
                    <td className="p-3 text-[#c4b49a]/70">{(item.roles as { name: string } | null)?.name ?? '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold ${item.dashboard_access ? 'text-green-400' : 'text-[#6b5a47]'}`}>
                        {item.dashboard_access ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold ${item.financials_access ? 'text-green-400' : 'text-[#6b5a47]'}`}>
                        {item.financials_access ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                      <td colSpan={8} className="p-0">
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            {[
                              ['Name', item.name],
                              ['Email', item.email ?? '—'],
                              ['Phone', item.phone ?? '—'],
                              ['Role', (item.roles as { name: string } | null)?.name ?? '—'],
                              ['Dashboard Access', item.dashboard_access ? 'Yes' : 'No'],
                              ['Financials Access', item.financials_access ? 'Yes' : 'No'],
                            ].map(([label, val]) => (
                              <div key={label as string}>
                                <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-0.5">{label}</p>
                                <p className="text-sm text-[#c4b49a]">{val}</p>
                              </div>
                            ))}
                            <div className="flex gap-3 pt-2">
                              <button onClick={() => openEdit(item)}
                                className="text-xs text-[#c8843a] border border-[#c8843a]/30 rounded-lg px-3 py-1.5 hover:bg-[#c8843a]/10 transition-colors">
                                Edit
                              </button>
                              <button onClick={() => setConfirmDelete([item.id])}
                                className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
                                Delete employee
                              </button>
                            </div>
                          </div>
                          <div>
                            <RecordComments orgId={orgId} recordId={item.id} tableName="employees" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-[#2e2016] text-xs text-[#c4b49a]/40">
            Showing {filtered.length} of {items.length} employees
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1810] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">
              Delete {confirmDelete.length === 1 ? 'this employee' : `${confirmDelete.length} employees`}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg py-2 hover:text-[#c4b49a] transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50 transition-colors">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}