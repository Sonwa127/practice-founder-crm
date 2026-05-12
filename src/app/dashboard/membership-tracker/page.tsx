'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RoleGuard from '@/components/RoleGuard'
import RecordComments from '@/components/RecordComments'

interface MembershipEntry {
  id: string
  submitted_by: string | null
  week_start: string
  week_end: string
  new_members_this_week: number
  returning_members: number
  cancelled_this_week: number
  active_members_total: number
  membership_revenue: number
  created_at: string
}

const ZERO_FORM = {
  week_start: '',
  week_end: '',
  new_members_this_week: '',
  returning_members: '',
  cancelled_this_week: '',
  active_members_total: '',
  membership_revenue: '',
}

type FormData = typeof ZERO_FORM

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button type="button"
        className="w-4 h-4 rounded-full border border-[#c8843a]/40 text-[#c8843a] text-[10px] leading-none hover:bg-[#c8843a]/10"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      >?</button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1a1410] border border-[#c8843a]/30 rounded-lg p-3 text-xs text-[#c4b49a] shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}

const inputClass = "bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-[#c8843a]"

function SectionBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#c8843a]/10 border border-[#c8843a]/20 rounded-lg px-4 py-3 mb-3">
      <div className="text-[#c8843a] font-semibold text-sm">{title}</div>
      <div className="text-[#c4b49a]/70 text-xs mt-0.5">{description}</div>
    </div>
  )
}

function MembershipTrackerInner() {
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)
  const [records, setRecords] = useState<MembershipEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(ZERO_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function loadRecords() {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('membership_tracker')
      .select('*')
      .eq('org_id', orgId)
      .order('week_start', { ascending: false })
      .limit(20)
    setRecords((data as MembershipEntry[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRecords() }, [orgId])

  function openNew() { setForm(ZERO_FORM); setEditId(null); setShowForm(true); setError(null) }

  function openEdit(r: MembershipEntry) {
    setForm({
      week_start: r.week_start,
      week_end: r.week_end,
      new_members_this_week: String(r.new_members_this_week),
      returning_members: String(r.returning_members),
      cancelled_this_week: String(r.cancelled_this_week),
      active_members_total: String(r.active_members_total),
      membership_revenue: String(r.membership_revenue),
    })
    setEditId(r.id)
    setShowForm(true)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !employeeId) return
    if (!form.week_start || !form.week_end) { setError('Week Start and Week End are required.'); return }
    if (new Date(form.week_end) < new Date(form.week_start)) { setError('Week End must be after Week Start.'); return }
    setSaving(true)
    setError(null)
    const payload = {
      org_id: orgId,
      submitted_by: employeeId,
      week_start: form.week_start,
      week_end: form.week_end,
      new_members_this_week: parseInt(form.new_members_this_week) || 0,
      returning_members: parseInt(form.returning_members) || 0,
      cancelled_this_week: parseInt(form.cancelled_this_week) || 0,
      active_members_total: parseInt(form.active_members_total) || 0,
      membership_revenue: parseFloat(form.membership_revenue) || 0,
    }
    if (editId) {
      await supabase.from('membership_tracker').update(payload).eq('id', editId)
    } else {
      await supabase.from('membership_tracker').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadRecords()
  }

  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} record(s)?`)) return
    await supabase.from('membership_tracker').delete().in('id', Array.from(selected))
    setSelected(new Set())
    loadRecords()
  }

  if (userLoading || loading) return <div className="p-8 text-[#c4b49a] animate-pulse">Loading…</div>

  return (
    <div className="min-h-screen bg-[#1a1410] text-[#c4b49a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Membership Tracker</h1>
            <p className="text-[#c4b49a]/60 text-xs mt-0.5">Weekly snapshot of membership activity. Count-only — no plan details or per-member usage.</p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <button onClick={bulkDelete} className="text-xs text-red-400 border border-red-800/40 rounded px-3 py-1.5 hover:bg-red-950/30">
                Delete {selected.size}
              </button>
            )}
            <button onClick={openNew} className="bg-[#c8843a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#b8732a]">
              + New Entry
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-[#c8843a]/30 rounded-xl bg-[#1e1810] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">{editId ? 'Edit Entry' : 'Membership Tracker — Weekly Report'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/60 hover:text-white text-xl">×</button>
            </div>
            <p className="text-[#c4b49a]/60 text-xs mb-4 italic">
              Submit this form weekly to report membership activity. Track new sign-ups, returning members, cancellations, and total revenue. Do not include plan details or per-member usage — this is a count-only summary.
            </p>

            {error && <div className="bg-red-950/40 border border-red-800/50 text-red-300 text-xs rounded p-2 mb-3">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* GENERAL */}
              <SectionBanner title="GENERAL — Submission Details" description="Enter the week this report covers." />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Week Start <span className="text-red-400">*</span></label>
                  <input type="date" value={form.week_start} onChange={e => setForm({ ...form, week_start: e.target.value })} className={inputClass} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Week End <span className="text-red-400">*</span></label>
                  <input type="date" value={form.week_end} onChange={e => setForm({ ...form, week_end: e.target.value })} className={inputClass} required />
                </div>
              </div>

              {/* MEMBERSHIP COUNTS */}
              <SectionBanner title="MEMBERSHIP COUNTS — Member Activity This Week"
                description="These numbers reflect activity that occurred during the week above — not historical totals. Enter 0 if none." />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">
                    New Members This Week <span className="text-red-400">*</span>
                    <Tip text="Patients who enrolled in a membership plan for the first time this week. Count only new enrollments, not renewals." />
                  </label>
                  <input type="number" min="0" step="1" value={form.new_members_this_week} onChange={e => setForm({ ...form, new_members_this_week: e.target.value })} className={inputClass} placeholder="0" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">
                    Returning Members <span className="text-red-400">*</span>
                    <Tip text="Existing members who renewed their membership this week or continued without interruption. Do not double-count new members here." />
                  </label>
                  <input type="number" min="0" step="1" value={form.returning_members} onChange={e => setForm({ ...form, returning_members: e.target.value })} className={inputClass} placeholder="0" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">
                    Cancelled This Week <span className="text-red-400">*</span>
                    <Tip text="Members who formally cancelled their membership this week. Count the cancellation in the week it was processed, not when the membership expires." />
                  </label>
                  <input type="number" min="0" step="1" value={form.cancelled_this_week} onChange={e => setForm({ ...form, cancelled_this_week: e.target.value })} className={inputClass} placeholder="0" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">
                    Active Members Total <span className="text-red-400">*</span>
                    <Tip text="The total number of active members in the program as of the last day of this reporting week. This is a running total, not just this week's activity." />
                  </label>
                  <input type="number" min="0" step="1" value={form.active_members_total} onChange={e => setForm({ ...form, active_members_total: e.target.value })} className={inputClass} placeholder="0" />
                </div>
              </div>

              {/* REVENUE */}
              <SectionBanner title="REVENUE — Membership Revenue" description="Total membership fees collected or charged this week." />
              <div className="max-w-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">
                    Membership Revenue This Week ($) <span className="text-red-400">*</span>
                    <Tip text="Total membership fees collected or charged this week. Include all tiers and plans. Do not include non-membership revenue here." />
                  </label>
                  <input type="number" step="0.01" min="0" value={form.membership_revenue} onChange={e => setForm({ ...form, membership_revenue: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
              </div>

              {/* Confirmation */}
              <div className="bg-[#2e2016]/40 border border-[#2e2016] rounded-lg p-3 text-xs text-[#c4b49a]/70">
                Confirm all five fields are completed before submitting. Enter 0 if there were no new members, cancellations, or other activity in a category this week.
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="bg-[#c8843a] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#b8732a] disabled:opacity-50">
                  {saving ? 'Saving…' : editId ? 'Update' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border border-[#2e2016] text-[#c4b49a] rounded-lg px-5 py-2 text-sm hover:border-[#c8843a]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {records.length === 0 && !showForm ? (
          <div className="text-center py-16 text-[#c4b49a]/40 text-sm">No entries yet.</div>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="border border-[#2e2016] rounded-xl bg-[#1e1810] overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#2e2016]/20"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => {
                    const s = new Set(selected); s.has(r.id) ? s.delete(r.id) : s.add(r.id); setSelected(s)
                  }} onClick={e => e.stopPropagation()} className="accent-[#c8843a] shrink-0" />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="text-white font-medium">{r.week_start} — {r.week_end}</div>
                      <div className="text-[#c4b49a]/60 text-xs">{resolveName(r.submitted_by)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Active Members</div>
                      <div className="text-white font-semibold">{r.active_members_total}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">New / Cancelled</div>
                      <div className="text-white">+{r.new_members_this_week} / −{r.cancelled_this_week}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Revenue</div>
                      <div className="text-white">${r.membership_revenue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</div>
                    </div>
                  </div>
                  <span className="text-[#c4b49a]/40 text-xs shrink-0">{expandedId === r.id ? '▲' : '▼'}</span>
                </div>
                {expandedId === r.id && (
                  <div className="border-t border-[#2e2016] p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div><div className="text-[#c4b49a]/50 text-xs">New Members</div><div className="text-white">{r.new_members_this_week}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Returning Members</div><div className="text-white">{r.returning_members}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Cancelled</div><div className="text-white">{r.cancelled_this_week}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Active Total</div><div className="text-white font-semibold">{r.active_members_total}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Revenue</div><div className="text-white">${r.membership_revenue?.toFixed(2)}</div></div>
                    </div>
                    <RecordComments recordId={r.id} tableName="membership_tracker" orgId={orgId!} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MembershipTrackerPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner']}>
      <MembershipTrackerInner />
    </RoleGuard>
  )
}