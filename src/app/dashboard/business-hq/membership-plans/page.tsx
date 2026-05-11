'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RecordComments from '@/components/RecordComments'
import RoleGuard from '@/components/RoleGuard'

interface MembershipPlan {
  id: string
  org_id: string
  name: string
  price_monthly: number | null
  price_annually: number | null
  description: string | null
  features: string | null
  is_active: boolean
  created_at: string
}

export default function MembershipPlansPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'admin', 'member']}>
      <MembershipPlansContent />
    </RoleGuard>
  )
}

function MembershipPlansContent() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { orgId, isLoading: userLoading } = useOrgUser()

  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editField, setEditField]       = useState<string | null>(null)
  const [editValue, setEditValue]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const emptyForm = {
    name: '',
    price_monthly: '',
    price_annually: '',
    description: '',
    features: '',
    is_active: true,
  }
  const [form, setForm] = useState(emptyForm)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['membership-plans', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('org_id', orgId!)
        .order('name')
      if (error) throw error
      return data as MembershipPlan[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['membership-plans', orgId] })

  const createMutation = useMutation({
    mutationFn: async (p: typeof emptyForm) => {
      const { error } = await supabase.from('membership_plans').insert({
        org_id: orgId,
        name: p.name,
        price_monthly: p.price_monthly ? parseFloat(p.price_monthly) : null,
        price_annually: p.price_annually ? parseFloat(p.price_annually) : null,
        description: p.description || null,
        features: p.features || null,
        is_active: p.is_active,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase
        .from('membership_plans')
        .update({ [field]: value || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setEditingId(null); setEditField(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('membership_plans').delete().in('id', ids)
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#c8843a] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Business HQ</p>
          <h1 className="text-2xl font-semibold text-[#c4b49a]">Membership Plans</h1>
          <p className="text-sm text-[#c4b49a]/60 mt-1">Configure the membership plans your practice offers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Plan
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4b49a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plans…"
            className="w-full pl-9 pr-4 py-2 bg-[#1f1a14] border border-[#2e2016] rounded-lg text-sm text-[#c4b49a] placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a]/50"
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setConfirmDelete([...selectedIds])}
            className="px-3 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors"
          >
            Delete ({selectedIds.size})
          </button>
        )}
      </div>

      <div className="bg-[#1f1a14] border border-[#2e2016] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2e2016]">
              <th className="p-3 w-10">
                <input type="checkbox" checked={allSelected}
                  onChange={e => { if (e.target.checked) setSelectedIds(new Set(filtered.map(i => i.id))); else setSelectedIds(new Set()) }}
                  className="w-4 h-4 accent-[#c8843a]" />
              </th>
              <th className="p-3 w-8" />
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Plan Name</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Monthly</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Annually</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest text-[#c4b49a]/50 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#c4b49a]/40 text-sm">
                  No membership plans yet. Add the first one.
                </td>
              </tr>
            ) : filtered.map(item => (
              <>
                <tr key={item.id} className={`border-b border-[#2e2016]/50 hover:bg-[#2a1f14]/40 transition-colors ${expandedId === item.id ? 'bg-[#2a1f14]/40' : ''}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.has(item.id)}
                      onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(item.id) : n.delete(item.id); setSelectedIds(n) }}
                      className="w-4 h-4 accent-[#c8843a]" />
                  </td>
                  <td className="p-3">
                    <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-[#c4b49a]/40 hover:text-[#c8843a] transition-colors">
                      <svg className={`w-4 h-4 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </td>
                  <td className="p-3">
                    {editingId === item.id && editField === 'name' ? (
                      <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}}
                        className="w-full bg-[#1a1410] border border-[#c8843a]/50 rounded px-2 py-1 text-[#c4b49a] text-sm focus:outline-none" />
                    ) : (
                      <span className="text-[#c4b49a] cursor-pointer hover:text-[#c8843a] transition-colors font-medium"
                        onClick={() => startEdit(item.id, 'name', item.name)}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">
                    {item.price_monthly != null ? `$${item.price_monthly}/mo` : '—'}
                  </td>
                  <td className="p-3 text-[#c4b49a]/70 text-xs">
                    {item.price_annually != null ? `$${item.price_annually}/yr` : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-900/30 text-green-400 border border-green-700/40' : 'bg-[#2e2016] text-[#c4b49a]/40 border border-[#2e2016]'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>

                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-[#1a1410] border-b border-[#2e2016]">
                    <td colSpan={6} className="p-0">
                      <div className="p-6 grid grid-cols-2 gap-8">
                        <div className="space-y-5">
                          {[
                            { label: 'Plan Name',       field: 'name',           value: item.name,           multiline: false },
                            { label: 'Monthly Price',   field: 'price_monthly',  value: String(item.price_monthly ?? ''), multiline: false },
                            { label: 'Annual Price',    field: 'price_annually', value: String(item.price_annually ?? ''), multiline: false },
                            { label: 'Description',     field: 'description',    value: item.description,    multiline: true  },
                            { label: 'Features',        field: 'features',       value: item.features,       multiline: true  },
                          ].map(f => (
                            <div key={f.field}>
                              <p className="text-xs text-[#c4b49a]/40 uppercase tracking-widest mb-1">{f.label}</p>
                              {editingId === item.id && editField === f.field ? (
                                f.multiline ? (
                                  <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                                    onBlur={commitEdit} rows={3}
                                    className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none resize-none" />
                                ) : (
                                  <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditField(null) }}}
                                    className="w-full bg-[#1f1a14] border border-[#c8843a]/50 rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none" />
                                )
                              ) : (
                                <p className="text-sm text-[#c4b49a]/80 cursor-pointer hover:text-[#c4b49a] min-h-[2rem] leading-relaxed"
                                  onClick={() => startEdit(item.id, f.field, f.value ?? '')}>
                                  {f.value || <span className="text-[#c4b49a]/30 italic">Click to add…</span>}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <div>
                          <RecordComments orgId={orgId} recordId={item.id} tableName="membership_plans" />
                        </div>
                      </div>
                      <div className="px-6 pb-4 flex justify-end">
                        <button onClick={() => setConfirmDelete([item.id])} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
                          Delete plan
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
            Showing {filtered.length} of {items.length} plans
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#c4b49a]">New Membership Plan</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/40 hover:text-[#c4b49a]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Monthly Price ($)</label>
                <input type="number" value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
              </div>
              <div>
                <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Annual Price ($)</label>
                <input type="number" value={form.price_annually} onChange={e => setForm(p => ({ ...p, price_annually: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" />
            </div>
            <div>
              <label className="block text-xs text-[#c4b49a]/50 uppercase tracking-widest mb-1">Features</label>
              <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))}
                rows={3} placeholder="List features, one per line…"
                className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]/50 resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-[#c8843a]" />
              <label htmlFor="is_active" className="text-sm text-[#c4b49a]/70">Active plan</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button
                onClick={() => { if (form.name.trim()) createMutation.mutate(form) }}
                disabled={!form.name.trim() || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#c8843a] hover:bg-[#b8732a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f1a14] border border-[#2e2016] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#c4b49a]">Confirm Delete</h2>
            <p className="text-sm text-[#c4b49a]/70">
              Delete {confirmDelete.length === 1 ? 'this plan' : `${confirmDelete.length} plans`}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 border border-[#2e2016] text-[#c4b49a]/60 text-sm rounded-lg hover:text-[#c4b49a] transition-colors">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}