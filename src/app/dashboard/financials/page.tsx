'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RoleGuard from '@/components/RoleGuard'
import RecordComments from '@/components/RecordComments'

interface WeeklyReport {
  id: string
  submitted_by: string | null
  week_start: string
  week_end: string
  is_completed: boolean
  bills_expenses_paid: number
  other_deposits: number
  cash_card_check: number
  insurance_payments: number
  revenue_collected: number
  payroll_for_week: number
  contractor_payments: number
  owner_pay_for_week: number
  owner_pay_distributed: boolean
  payroll_starting_balance: number
  blocked_money_notes: string | null
  staffing_gaps_notes: string | null
  one_thing_to_fix: string | null
  total_labour_costs: number
  end_of_week_balance: number
  created_at: string
}

const emptyForm = {
  week_start: '',
  week_end: '',
  is_completed: false,
  bills_expenses_paid: '',
  other_deposits: '',
  cash_card_check: '',
  insurance_payments: '',
  revenue_collected: '',
  payroll_for_week: '',
  contractor_payments: '',
  owner_pay_for_week: '',
  owner_pay_distributed: false,
  payroll_starting_balance: '',
  blocked_money_notes: '',
  staffing_gaps_notes: '',
  one_thing_to_fix: '',
}

type FormData = typeof emptyForm

function currency(v: number | string | null): string {
  if (v === null || v === '' || v === undefined) return 'N/A'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return 'N/A'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(num: number | string, den: number | string): string {
  const n = parseFloat(String(num)), d = parseFloat(String(den))
  if (!d || isNaN(n) || isNaN(d)) return 'N/A'
  return `${((n / d) * 100).toFixed(1)}%`
}

function calcEndOfWeek(f: FormData): number {
  const payrollStart = parseFloat(f.payroll_starting_balance) || 0
  const rev = parseFloat(f.revenue_collected) || 0
  const bills = parseFloat(f.bills_expenses_paid) || 0
  const payroll = parseFloat(f.payroll_for_week) || 0
  const contractors = parseFloat(f.contractor_payments) || 0
  const ownerPay = parseFloat(f.owner_pay_for_week) || 0
  return payrollStart + rev - bills - payroll - contractors - ownerPay
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full border border-[#c8843a]/40 text-[#c8843a] text-[10px] leading-none hover:bg-[#c8843a]/10 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >?</button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1a1410] border border-[#c8843a]/30 rounded-lg p-2.5 text-xs text-[#c4b49a] shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}

function FormField({
  label, tooltip, children, required
}: { label: string, tooltip?: string, children: React.ReactNode, required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[#c4b49a]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      {children}
    </div>
  )
}

const inputClass = "bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a] transition-colors w-full"

function SectionBanner({ title, description }: { title: string, description: string }) {
  return (
    <div className="bg-[#c8843a]/10 border border-[#c8843a]/20 rounded-lg px-4 py-3 mb-4">
      <div className="text-[#c8843a] font-semibold text-sm">{title}</div>
      <div className="text-[#c4b49a]/70 text-xs mt-0.5">{description}</div>
    </div>
  )
}

function WeeklyFinancialInner() {
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)
  const qc = useQueryClient()
  const { data: records = [], isLoading: loading } = useQuery({
    queryKey: ['weekly_financial_reports', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_financial_reports')
        .select('*')
        .eq('practice_id', orgId)
        .order('week_start', { ascending: false })
      return (data as WeeklyReport[]) ?? []
    },
  })

  function invalidate() { qc.invalidateQueries({ queryKey: ['weekly_financial_reports', orgId] }) }
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()



  function setField(key: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function openNew() {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(r: WeeklyReport) {
    setForm({
      week_start: r.week_start,
      week_end: r.week_end,
      is_completed: r.is_completed,
      bills_expenses_paid: String(r.bills_expenses_paid),
      other_deposits: String(r.other_deposits),
      cash_card_check: String(r.cash_card_check),
      insurance_payments: String(r.insurance_payments),
      revenue_collected: String(r.revenue_collected),
      payroll_for_week: String(r.payroll_for_week),
      contractor_payments: String(r.contractor_payments),
      owner_pay_for_week: String(r.owner_pay_for_week),
      owner_pay_distributed: r.owner_pay_distributed,
      payroll_starting_balance: String(r.payroll_starting_balance),
      blocked_money_notes: r.blocked_money_notes ?? '',
      staffing_gaps_notes: r.staffing_gaps_notes ?? '',
      one_thing_to_fix: r.one_thing_to_fix ?? '',
    })
    setEditId(r.id)
    setShowForm(true)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !employeeId) return
    if (!form.week_start || !form.week_end) {
      setError('Week Start and Week End are required.')
      return
    }
    if (new Date(form.week_end) < new Date(form.week_start)) {
      setError('Week End must be after Week Start.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      practice_id: orgId,
      submitted_by: employeeId,
      week_start: form.week_start,
      week_end: form.week_end,
      is_completed: form.is_completed,
      bills_expenses_paid: parseFloat(form.bills_expenses_paid) || 0,
      other_deposits: parseFloat(form.other_deposits) || 0,
      cash_card_check: parseFloat(form.cash_card_check) || 0,
      insurance_payments: parseFloat(form.insurance_payments) || 0,
      revenue_collected: parseFloat(form.revenue_collected) || 0,
      payroll_for_week: parseFloat(form.payroll_for_week) || 0,
      contractor_payments: parseFloat(form.contractor_payments) || 0,
      owner_pay_for_week: parseFloat(form.owner_pay_for_week) || 0,
      owner_pay_distributed: form.owner_pay_distributed,
      payroll_starting_balance: parseFloat(form.payroll_starting_balance) || 0,
      blocked_money_notes: form.blocked_money_notes || null,
      staffing_gaps_notes: form.staffing_gaps_notes || null,
      one_thing_to_fix: form.one_thing_to_fix || null,
    }
    if (editId) {
      await supabase.from('weekly_financial_reports').update(payload).eq('id', editId)
    } else {
      await supabase.from('weekly_financial_reports').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    invalidate()
  }

  async function bulkDelete() {
    if (!selected.size) return
    if (!confirm(`Delete ${selected.size} record(s)?`)) return
    await supabase.from('weekly_financial_reports').delete().in('id', Array.from(selected))
    setSelected(new Set())
    invalidate()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const labourCosts = (parseFloat(form.payroll_for_week) || 0) + (parseFloat(form.contractor_payments) || 0)
  const endOfWeek = calcEndOfWeek(form)
  const payrollPct = pct(form.payroll_for_week, form.revenue_collected)

  if (userLoading) return <div className="p-8 text-[#c4b49a] animate-pulse">Loading…</div>

  return (
    <div className="bg-[#1a1410] text-[#c4b49a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Weekly Financial Reports</h1>
            <p className="text-[#c4b49a]/60 text-xs mt-0.5">Submit weekly to report all financial activity. Submitted by ops manager.</p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <button onClick={bulkDelete} className="text-xs text-red-400 border border-red-800/40 rounded px-3 py-1.5 hover:bg-red-950/30 transition-colors">
                Delete {selected.size}
              </button>
            )}
            <button onClick={openNew} className="text-sm bg-[#c8843a] text-white rounded-lg px-4 py-2 hover:bg-[#b8732a] transition-colors font-medium">
              + New Report
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="border border-[#c8843a]/30 rounded-xl bg-[#1e1810] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{editId ? 'Edit Report' : 'New Weekly Financial Report'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/60 hover:text-white text-xl leading-none">×</button>
            </div>

            <p className="text-[#c4b49a]/60 text-xs mb-4 italic">
              Submit this form weekly to report all financial activity for the week. You may save progress and return before marking it complete. All required fields must be filled before checking the Completed box.
            </p>

            {error && <div className="bg-red-950/40 border border-red-800/50 text-red-300 text-xs rounded p-2 mb-3">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* GENERAL */}
              <SectionBanner title="GENERAL — Submission Details" description="Enter the week this report covers. You can save progress and return later before marking it complete." />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Week Start" required>
                  <input type="date" value={form.week_start} onChange={e => setField('week_start', e.target.value)} className={inputClass} required autoComplete="off" />
                </FormField>
                <FormField label="Week End" required>
                  <input type="date" value={form.week_end} onChange={e => setField('week_end', e.target.value)} className={inputClass} required autoComplete="off" />
                </FormField>
                <FormField label="Is This Completed?">
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_completed} onChange={e => setField('is_completed', e.target.checked)} className="accent-[#c8843a]" />
                    <span className="text-sm">Mark complete</span>
                  </label>
                </FormField>
              </div>

              {/* REVENUE */}
              <SectionBanner
                title="REVENUE — Income & Collections"
                description="Enter all revenue and deposits received this week. Use separate fields for each payment source. Do not combine cash, card, check, or insurance into one number."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Cash, Card, or Check Payments ($)" required tooltip="Patient payments collected in-office via cash, card, or check. Do not include insurance here.">
                  <input type="number" step="0.01" min="0" value={form.cash_card_check} onChange={e => setField('cash_card_check', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Insurance Payments ($)" required tooltip="Total insurance payments deposited or posted this week.">
                  <input type="number" step="0.01" min="0" value={form.insurance_payments} onChange={e => setField('insurance_payments', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Other Deposits ($)" required tooltip="Any deposits received this week that are not standard revenue — reimbursements, grants, refunds from vendors, etc.">
                  <input type="number" step="0.01" min="0" value={form.other_deposits} onChange={e => setField('other_deposits', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Revenue Collected (Total) ($)" required tooltip="Sum of all income this week across all sources.">
                  <input type="number" step="0.01" min="0" value={form.revenue_collected} onChange={e => setField('revenue_collected', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
              </div>

              {/* EXPENSES */}
              <SectionBanner
                title="EXPENSES — Payroll, Contractors & Owner Pay"
                description="Payroll, contractor payments, and owner pay are three separate fields. Do not combine them. Labour Cost is auto-calculated from Payroll + Contractors only — owner pay is not included."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Payroll for the Week ($)" required tooltip="Total gross payroll paid to EMPLOYEES this week only. Do not include contractors or owner pay here.">
                  <input type="number" step="0.01" min="0" value={form.payroll_for_week} onChange={e => setField('payroll_for_week', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Contractor Payments ($)" required tooltip="Payments made to CONTRACTORS or freelancers this week. Separate from employee payroll.">
                  <input type="number" step="0.01" min="0" value={form.contractor_payments} onChange={e => setField('contractor_payments', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Owner Pay for the Week ($)" required tooltip="Dollar amount the practice owner was paid this week. Separate from payroll and contractors — not included in Labour Cost.">
                  <input type="number" step="0.01" min="0" value={form.owner_pay_for_week} onChange={e => setField('owner_pay_for_week', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
                <FormField label="Bills and Expenses Paid ($)" required tooltip="Total bills and operating expenses paid out this week.">
                  <input type="number" step="0.01" min="0" value={form.bills_expenses_paid} onChange={e => setField('bills_expenses_paid', e.target.value)} className={inputClass} placeholder="0.00" />
                </FormField>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.owner_pay_distributed} onChange={e => setField('owner_pay_distributed', e.target.checked)} className="accent-[#c8843a]" />
                  <span className="text-sm">Was Owner Pay Distributed this week?</span>
                </label>
              </div>

              {/* Auto-calculated display */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#2e2016]/30 rounded-lg p-3">
                <div>
                  <div className="text-xs text-[#c4b49a]/50 mb-0.5">Total Labour Costs (auto)</div>
                  <div className="text-white font-semibold">{currency(labourCosts)}</div>
                  <div className="text-[10px] text-[#c4b49a]/40">Payroll + Contractors</div>
                </div>
                <div>
                  <div className="text-xs text-[#c4b49a]/50 mb-0.5">Payroll as % of Revenue (auto)</div>
                  <div className="text-white font-semibold">{payrollPct}</div>
                </div>
                <div>
                  <div className="text-xs text-[#c4b49a]/50 mb-0.5">End of Week Balance (auto)</div>
                  <div className={`font-semibold ${endOfWeek < 0 ? 'text-red-400' : 'text-white'}`}>{currency(endOfWeek)}</div>
                  <div className="text-[10px] text-[#c4b49a]/40">Payroll Start + Rev − Expenses</div>
                </div>
              </div>

              {/* BALANCE */}
              <SectionBanner title="BALANCE — Account Balance" description="Enter the starting balance of the payroll account only." />
              <FormField label="Payroll Starting Balance ($)" required tooltip="Starting balance of the payroll account at the beginning of this week.">
                <input type="number" step="0.01" min="0" value={form.payroll_starting_balance} onChange={e => setField('payroll_starting_balance', e.target.value)} className={`${inputClass} max-w-xs`} placeholder="0.00" />
              </FormField>

              {/* REFLECTION */}
              <SectionBanner title="REFLECTION — Blockers & Next Steps" description="These fields help the Practice Founder team identify where money slowed down and what needs attention next week." />
              <div className="space-y-4">
                <FormField label="What Blocked Money This Week?" tooltip="Any payments delayed, holds, or unexpected gaps in cash flow this week.">
                  <textarea value={form.blocked_money_notes} onChange={e => setField('blocked_money_notes', e.target.value)} rows={2} className={inputClass} placeholder="Any payments delayed, holds, or unexpected gaps…" />
                </FormField>
                <FormField label="What Staffing Gaps Were There?" tooltip="Any gaps that affected revenue, operations, or billing this week.">
                  <textarea value={form.staffing_gaps_notes} onChange={e => setField('staffing_gaps_notes', e.target.value)} rows={2} className={inputClass} placeholder="Any gaps that affected revenue or billing…" />
                </FormField>
                <FormField label="One Thing to Fix Next Week" tooltip="The single highest-priority improvement for next week. Choose one item only.">
                  <input type="text" value={form.one_thing_to_fix} onChange={e => setField('one_thing_to_fix', e.target.value)} className={inputClass} placeholder="One priority improvement item…" />
                </FormField>
              </div>

              {/* Confirmation note */}
              <div className="bg-[#2e2016]/40 border border-[#2e2016] rounded-lg p-3 text-xs text-[#c4b49a]/70">
                Before submitting, confirm all revenue and expense fields are completed and the Is This Completed? checkbox is checked. If you are still waiting on a number, leave the checkbox unchecked and return to complete it.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-[#c8843a] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#b8732a] disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : editId ? 'Update Report' : 'Submit Report'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border border-[#2e2016] text-[#c4b49a] rounded-lg px-5 py-2 text-sm hover:border-[#c8843a] transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Records list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="border border-[#2e2016] rounded-xl bg-[#1e1810] p-4 animate-pulse">
                <div className="h-4 bg-[#2e2016] rounded w-1/3 mb-2" />
                <div className="h-3 bg-[#2e2016] rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : records.length === 0 && !showForm ? (
          <div className="text-center py-16 text-[#c4b49a]/40 text-sm">No reports yet. Submit the first one above.</div>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="border border-[#2e2016] rounded-xl bg-[#1e1810] overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#2e2016]/20 transition-colors"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                    onClick={e => e.stopPropagation()} className="accent-[#c8843a] shrink-0" />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="text-white font-medium">{r.week_start} — {r.week_end}</div>
                      <div className="text-[#c4b49a]/60 text-xs">{resolveName(r.submitted_by)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Revenue</div>
                      <div className="text-white text-sm">{currency(r.revenue_collected)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Payroll %</div>
                      <div className="text-white text-sm">{pct(r.payroll_for_week, r.revenue_collected)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.is_completed ? 'border-emerald-700 text-emerald-400' : 'border-amber-700 text-amber-400'}`}>
                        {r.is_completed ? 'Complete' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(r) }} className="text-xs text-[#c8843a] hover:underline">Edit</button>
                    <span className="text-[#2e2016]">|</span>
                    <span className="text-[#c4b49a]/40 text-xs">{expandedId === r.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandedId === r.id && (
                  <div className="border-t border-[#2e2016] p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      {[
                        ['Cash/Card/Check', currency(r.cash_card_check)],
                        ['Insurance Payments', currency(r.insurance_payments)],
                        ['Other Deposits', currency(r.other_deposits)],
                        ['Revenue Collected', currency(r.revenue_collected)],
                        ['Payroll', currency(r.payroll_for_week)],
                        ['Contractors', currency(r.contractor_payments)],
                        ['Labour Costs', currency(r.total_labour_costs)],
                        ['Owner Pay', currency(r.owner_pay_for_week)],
                        ['Bills & Expenses', currency(r.bills_expenses_paid)],
                        ['Payroll Start Balance', currency(r.payroll_starting_balance)],
                        ['End of Week Balance', currency(r.end_of_week_balance)],
                        ['Owner Pay Distributed', r.owner_pay_distributed ? 'Yes' : 'No'],
                      ].map(([label, val]) => (
                        <div key={label as string}>
                          <div className="text-[#c4b49a]/50 text-xs">{label}</div>
                          <div className="text-white">{val}</div>
                        </div>
                      ))}
                    </div>
                    {(r.blocked_money_notes || r.staffing_gaps_notes || r.one_thing_to_fix) && (
                      <div className="space-y-2 pt-2 border-t border-[#2e2016]">
                        {r.blocked_money_notes && (
                          <div><span className="text-xs text-[#c4b49a]/50">Blocked Money:</span> <span className="text-sm text-white">{r.blocked_money_notes}</span></div>
                        )}
                        {r.staffing_gaps_notes && (
                          <div><span className="text-xs text-[#c4b49a]/50">Staffing Gaps:</span> <span className="text-sm text-white">{r.staffing_gaps_notes}</span></div>
                        )}
                        {r.one_thing_to_fix && (
                          <div><span className="text-xs text-[#c4b49a]/50">Fix Next Week:</span> <span className="text-sm text-white">{r.one_thing_to_fix}</span></div>
                        )}
                      </div>
                    )}
                    <RecordComments recordId={r.id} tableName="weekly_financial_reports" orgId={orgId!} />
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

export default function WeeklyFinancialPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner']}>
      <WeeklyFinancialInner />
    </RoleGuard>
  )
}