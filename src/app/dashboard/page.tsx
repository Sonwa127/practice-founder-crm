'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import RoleGuard from '@/components/RoleGuard'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiRow {
  practice_id: string
  practice_name: string
  // Revenue
  revenue_collected: number | null
  payroll_pct_of_revenue: number | null
  owner_pay_distributed: boolean | null
  // Collection
  collection_rate_pct: number | null
  collection_rate_date: string | null
  // Charge lag
  avg_charge_lag_days: number | null
  // Denial
  denial_rate_pct: number | null
  denial_rate_date: string | null
  // AR
  avg_days_in_ar: number | null
  ar_90plus_balance: number | null
  ar_90plus_pct: number | null
  // Resubmission
  avg_resubmission_turnaround: number | null
  // Notes same day
  notes_same_day_pct: number | null
  notes_date: string | null
  // Referral
  referral_completion_pct: number | null
  referral_date: string | null
  // Tasks
  task_completion_pct: number | null
  // Membership
  active_members_total: number | null
  new_members_this_week: number | null
  membership_revenue: number | null
  // Issues
  open_issues: number | null
  open_low: number | null
  open_medium: number | null
  open_high: number | null
  open_critical: number | null
  issues_opened_this_week: number | null
  issues_resolved_this_week: number | null
  // Huddle
  charts_not_closed_week: number | null
  claims_not_submitted_week: number | null
  huddles_complete_this_week: number | null
  latest_all_issues_have_owners: boolean | null
}

interface RevenueHistory {
  week_start: string
  revenue_collected: number
}

// ─── Threshold config (from HealthE KPI doc) ─────────────────────────────────

const THRESHOLDS = {
  charge_lag:         { target: 24,  alert: 48,   unit: 'hrs',  label: 'Charge Lag', dir: 'lower' },
  collection_rate:    { target: 95,  alert: 85,   unit: '%',    label: 'Collections Rate', dir: 'higher' },
  denial_rate:        { target: 5,   alert: 10,   unit: '%',    label: 'Denial Rate', dir: 'lower' },
  ar_90plus_pct:      { target: 5,   alert: 10,   unit: '%',    label: 'AR 90+ Days', dir: 'lower' },
  avg_days_in_ar:     { target: 30,  alert: 60,   unit: 'days', label: 'Avg Days in AR', dir: 'lower' },
  notes_same_day:     { target: 100, alert: 99,   unit: '%',    label: 'Notes Closed Same Day', dir: 'higher' },
  referral_rate:      { target: 100, alert: 90,   unit: '%',    label: 'Referral Completion', dir: 'higher' },
  task_completion:    { target: 95,  alert: 85,   unit: '%',    label: 'Task Completion', dir: 'higher' },
  resubmission:       { target: 3,   alert: 5,    unit: 'days', label: 'Denial Resubmission', dir: 'lower' },
} as const

type ThresholdKey = keyof typeof THRESHOLDS

function getStatus(key: ThresholdKey, value: number | null): 'on_target' | 'below_target' | 'critical' | 'na' {
  if (value === null || value === undefined) return 'na'
  const t = THRESHOLDS[key]
  if (t.dir === 'lower') {
    if (value <= t.target) return 'on_target'
    if (value <= t.alert) return 'below_target'
    return 'critical'
  } else {
    if (value >= t.target) return 'on_target'
    if (value >= t.alert) return 'below_target'
    return 'critical'
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(value: number | null, type: 'pct' | 'currency' | 'number' | 'days' | 'hrs'): string {
  if (value === null || value === undefined) return 'N/A'
  switch (type) {
    case 'pct':      return `${value.toFixed(1)}%`
    case 'currency': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'days':     return `${value} days`
    case 'hrs':      return `${value} hrs`
    default:         return value.toString()
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'on_target' | 'below_target' | 'critical' | 'na' }) {
  const map = {
    on_target:    'bg-emerald-500',
    below_target: 'bg-amber-400',
    critical:     'bg-red-500 animate-pulse',
    na:           'bg-[#2e2016]',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status]}`} />
}

function TrendArrow({ current, prior }: { current: number | null, prior: number | null }) {
  if (current === null || prior === null) return null
  const diff = current - prior
  if (Math.abs(diff) < 0.1) return <span className="text-[#c4b49a] text-xs">→</span>
  return diff > 0
    ? <span className="text-emerald-400 text-xs">↑ {Math.abs(diff).toFixed(1)}</span>
    : <span className="text-red-400 text-xs">↓ {Math.abs(diff).toFixed(1)}</span>
}

interface KpiCardProps {
  label: string
  value: string
  target?: string
  status?: 'on_target' | 'below_target' | 'critical' | 'na'
  subtext?: string
  alert?: string
  wide?: boolean
}

function KpiCard({ label, value, target, status, subtext, alert, wide }: KpiCardProps) {
  const borderMap = {
    on_target:    'border-emerald-800/40',
    below_target: 'border-amber-600/60',
    critical:     'border-red-600/80',
    na:           'border-[#2e2016]',
    undefined:    'border-[#2e2016]',
  }
  const bgMap = {
    critical: 'bg-red-950/20',
    below_target: 'bg-amber-950/10',
  }
  const border = borderMap[status ?? 'undefined']
  const bg = (status === 'critical' || status === 'below_target') ? bgMap[status] : ''

  return (
    <div className={`rounded-lg border ${border} ${bg} p-4 flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#c4b49a] text-xs font-medium uppercase tracking-wider truncate">{label}</span>
        {status && <StatusDot status={status} />}
      </div>
      <div className="text-2xl font-bold text-white leading-none mt-1">{value}</div>
      {target && (
        <div className="text-xs text-[#c4b49a]/60">Target: {target}</div>
      )}
      {subtext && (
        <div className="text-xs text-[#c4b49a]/70 mt-0.5">{subtext}</div>
      )}
      {alert && status === 'critical' && (
        <div className="text-xs text-red-400 font-medium mt-1 bg-red-950/30 rounded px-2 py-1">
          ⚠ {alert}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string, sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 mt-6">
      <h2 className="text-[#c8843a] text-sm font-semibold uppercase tracking-widest">{title}</h2>
      {sub && <span className="text-[#c4b49a]/50 text-xs">{sub}</span>}
      <div className="flex-1 border-t border-[#2e2016]" />
    </div>
  )
}

function IssueBreakdown({ low, medium, high, critical }: { low: number | null, medium: number | null, high: number | null, critical: number | null }) {
  const items = [
    { label: 'Critical', count: critical ?? 0, color: 'text-red-400' },
    { label: 'High',     count: high ?? 0,     color: 'text-orange-400' },
    { label: 'Medium',   count: medium ?? 0,   color: 'text-amber-400' },
    { label: 'Low',      count: low ?? 0,       color: 'text-[#c4b49a]' },
  ]
  return (
    <div className="flex gap-3 flex-wrap mt-1">
      {items.map(i => (
        <span key={i.label} className={`text-xs ${i.color}`}>
          {i.count} {i.label}
        </span>
      ))}
    </div>
  )
}

function RevenueChart({ data }: { data: RevenueHistory[] }) {
  if (!data.length) return (
    <div className="h-24 flex items-center justify-center text-[#c4b49a]/40 text-sm">No data yet</div>
  )
  const max = Math.max(...data.map(d => d.revenue_collected))
  const recent = data.slice(-8)
  return (
    <div className="flex items-end gap-1.5 h-20 mt-2">
      {recent.map((d, i) => {
        const pct = max > 0 ? (d.revenue_collected / max) * 100 : 0
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.week_start}: ${fmt(d.revenue_collected, 'currency')}`}>
            <div
              className="w-full rounded-sm bg-[#c8843a]/60 hover:bg-[#c8843a] transition-colors"
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
            <span className="text-[10px] text-[#c4b49a]/40 rotate-45 origin-left whitespace-nowrap">
              {d.week_start?.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

function DashboardInner() {
  const { orgId, isLoading: userLoading } = useOrgUser()
  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [revenueHistory, setRevenueHistory] = useState<RevenueHistory[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function loadData() {
    if (!orgId) return
    setLoading(true)
    try {
      const [{ data: kpiData }, { data: revData }] = await Promise.all([
        supabase
          .from('v_kpi_dashboard')
          .select('*')
          .eq('practice_id', orgId)
          .single(),
        supabase
          .from('v_kpi_revenue')
          .select('week_start, revenue_collected')
          .eq('practice_id', orgId)
          .order('week_start', { ascending: true })
          .limit(12),
      ])
      if (kpiData) setKpi(kpiData as KpiRow)
      if (revData) setRevenueHistory(revData as RevenueHistory[])
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orgId])

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex items-center justify-center">
        <div className="text-[#c8843a] text-sm animate-pulse">Loading dashboard…</div>
      </div>
    )
  }

  if (!kpi) {
    return (
      <div className="min-h-screen bg-[#1a1410] flex flex-col items-center justify-center gap-3 text-center p-8">
        <div className="text-4xl">📊</div>
        <h2 className="text-white text-lg font-semibold">No data yet</h2>
        <p className="text-[#c4b49a] text-sm max-w-sm">
          The dashboard will populate automatically as your team submits their daily and weekly forms.
        </p>
      </div>
    )
  }

  // Threshold alert list for top banner
  const alerts: string[] = []
  if (getStatus('charge_lag', kpi.avg_charge_lag_days) === 'critical')
    alerts.push(`Charge lag at ${kpi.avg_charge_lag_days} hrs — target <24 hrs`)
  if (getStatus('collection_rate', kpi.collection_rate_pct) === 'critical')
    alerts.push(`Collections rate at ${kpi.collection_rate_pct}% — target ≥95%`)
  if (getStatus('denial_rate', kpi.denial_rate_pct) === 'critical')
    alerts.push(`Denial rate at ${kpi.denial_rate_pct}% — target <5%`)
  if (getStatus('ar_90plus_pct', kpi.ar_90plus_pct) === 'critical')
    alerts.push(`AR 90+ days at ${kpi.ar_90plus_pct}% of total AR — target <5%`)
  if (getStatus('notes_same_day', kpi.notes_same_day_pct) === 'critical')
    alerts.push(`Notes not closed same day — 100% required`)

  return (
    <div className="min-h-screen bg-[#1a1410] text-[#c4b49a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-1">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-white text-xl font-bold">KPI Dashboard</h1>
            <p className="text-[#c4b49a]/60 text-xs mt-0.5">
              {kpi.practice_name} · Refreshed {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={loadData}
            className="text-xs text-[#c8843a] border border-[#c8843a]/30 rounded px-3 py-1.5 hover:bg-[#c8843a]/10 transition-colors self-start sm:self-auto"
          >
            Refresh
          </button>
        </div>

        {/* Threshold Alert Banner */}
        {alerts.length > 0 && (
          <div className="rounded-lg border border-red-800/60 bg-red-950/30 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 text-sm font-semibold">⚠ Threshold Alerts — Immediate Action Required</span>
            </div>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-red-300 text-xs flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── PANEL A ─────────────────────────────────────── */}
        <div className="border border-[#2e2016] rounded-xl p-4 bg-[#1e1810]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-semibold text-sm">Panel A — Financial & Clinical</h2>
            <span className="text-[#c4b49a]/40 text-xs">Physician + Manager review</span>
          </div>

          {/* REVENUE */}
          <SectionHeader title="Revenue" />
          <div className="mb-4">
            <div className="text-xs text-[#c4b49a]/60 mb-1">Weekly revenue trend (last 8 weeks)</div>
            <RevenueChart data={revenueHistory} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <KpiCard
              label="Revenue Collected"
              value={fmt(kpi.revenue_collected, 'currency')}
              subtext="Most recent week"
            />
            <KpiCard
              label="Payroll % of Revenue"
              value={fmt(kpi.payroll_pct_of_revenue, 'pct')}
              target="Set at onboarding"
              status={
                kpi.payroll_pct_of_revenue !== null
                  ? kpi.payroll_pct_of_revenue <= 30 ? 'on_target' : kpi.payroll_pct_of_revenue <= 40 ? 'below_target' : 'critical'
                  : 'na'
              }
            />
            <KpiCard
              label="Owner Pay On Schedule"
              value={kpi.owner_pay_distributed === null ? 'N/A' : kpi.owner_pay_distributed ? 'Yes ✓' : 'No ✗'}
              status={
                kpi.owner_pay_distributed === null ? 'na' :
                kpi.owner_pay_distributed ? 'on_target' : 'critical'
              }
              alert="Owner draw missed — identify missed transfer and confirm catch-up date"
            />
            <KpiCard
              label="Active Members"
              value={fmt(kpi.active_members_total, 'number')}
              subtext={`+${kpi.new_members_this_week ?? 0} this week`}
            />
          </div>

          {/* BILLING */}
          <SectionHeader title="Billing" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <KpiCard
              label="Charge Lag (avg)"
              value={fmt(kpi.avg_charge_lag_days, 'hrs')}
              target="<24 hrs"
              status={getStatus('charge_lag', kpi.avg_charge_lag_days)}
              alert="Any claim >48 hrs: identify chart and cause. Correct same week."
            />
            <KpiCard
              label="Collection Rate"
              value={fmt(kpi.collection_rate_pct, 'pct')}
              target="≥95%"
              status={getStatus('collection_rate', kpi.collection_rate_pct)}
              subtext={kpi.collection_rate_date ?? undefined}
              alert="Below 85% — full AR recovery plan required at next Monday review."
            />
            <KpiCard
              label="Denial Rate"
              value={fmt(kpi.denial_rate_pct, 'pct')}
              target="<5%"
              status={getStatus('denial_rate', kpi.denial_rate_pct)}
              subtext={kpi.denial_rate_date ?? undefined}
              alert=">10% — pull denial log. Root cause + correction starts same week."
            />
            <KpiCard
              label="Denial Resubmission"
              value={fmt(kpi.avg_resubmission_turnaround, 'days')}
              target="<3 business days"
              status={getStatus('resubmission', kpi.avg_resubmission_turnaround)}
              alert="Any denial >3 days without resubmission: flag immediately."
            />
          </div>

          {/* ACCOUNTS RECEIVABLE */}
          <SectionHeader title="Accounts Receivable" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <KpiCard
              label="Avg Days in AR"
              value={fmt(kpi.avg_days_in_ar, 'days')}
              target="<30 days"
              status={getStatus('avg_days_in_ar', kpi.avg_days_in_ar)}
              alert="Rising trend = billing process problem. Investigate upstream."
            />
            <KpiCard
              label="AR 90+ Days Balance"
              value={fmt(kpi.ar_90plus_balance, 'currency')}
              subtext={kpi.ar_90plus_pct !== null ? `${kpi.ar_90plus_pct}% of total AR` : undefined}
            />
            <KpiCard
              label="AR 90+ % of Total"
              value={fmt(kpi.ar_90plus_pct, 'pct')}
              target="<5% of AR"
              status={getStatus('ar_90plus_pct', kpi.ar_90plus_pct)}
              alert=">10% — each account named at Monday review. Decision: appeal / write-off / plan."
            />
            <KpiCard
              label="Membership Revenue"
              value={fmt(kpi.membership_revenue, 'currency')}
              subtext="Most recent week"
            />
          </div>

          {/* OPERATIONS */}
          <SectionHeader title="Operations" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Notes Closed Same Day"
              value={fmt(kpi.notes_same_day_pct, 'pct')}
              target="100%"
              status={getStatus('notes_same_day', kpi.notes_same_day_pct)}
              subtext={kpi.notes_date ?? undefined}
              alert="Any miss: chart identified and closed before Monday review ends."
            />
            <KpiCard
              label="Referral Completion"
              value={fmt(kpi.referral_completion_pct, 'pct')}
              target="100% tracked"
              status={getStatus('referral_rate', kpi.referral_completion_pct)}
              subtext={kpi.referral_date ?? undefined}
              alert="Any untracked referral: identify and close gap before EOD Monday."
            />
            <KpiCard
              label="Task Completion"
              value={fmt(kpi.task_completion_pct, 'pct')}
              target=">95%"
              status={getStatus('task_completion', kpi.task_completion_pct)}
              alert="Below 95% — identify uncompleted tasks at huddle."
            />
            <KpiCard
              label="New Members This Week"
              value={fmt(kpi.new_members_this_week, 'number')}
              subtext="New enrollments"
            />
          </div>
        </div>

        {/* ── PANEL B ─────────────────────────────────────── */}
        <div className="border border-[#2e2016] rounded-xl p-4 bg-[#1e1810] mt-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-semibold text-sm">Panel B — Huddle & Issues</h2>
            <span className="text-[#c4b49a]/40 text-xs">Operational accountability</span>
          </div>

          {/* OPEN ISSUES */}
          <SectionHeader title="Issues" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div className={`rounded-lg border p-4 col-span-2 ${(kpi.open_critical ?? 0) > 0 ? 'border-red-600/80 bg-red-950/20' : 'border-[#2e2016]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[#c4b49a] text-xs font-medium uppercase tracking-wider">Open Issues</span>
                {(kpi.open_critical ?? 0) > 0 && <StatusDot status="critical" />}
              </div>
              <div className="text-3xl font-bold text-white mt-1">{kpi.open_issues ?? 0}</div>
              <IssueBreakdown
                low={kpi.open_low}
                medium={kpi.open_medium}
                high={kpi.open_high}
                critical={kpi.open_critical}
              />
            </div>
            <KpiCard
              label="Opened This Week"
              value={fmt(kpi.issues_opened_this_week, 'number')}
              subtext="New issues (last 7 days)"
            />
            <KpiCard
              label="Resolved This Week"
              value={fmt(kpi.issues_resolved_this_week, 'number')}
              subtext="Closed or resolved"
            />
          </div>

          {/* HUDDLE */}
          <SectionHeader title="Daily Huddle" sub="Current week" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Huddles Complete"
              value={`${kpi.huddles_complete_this_week ?? 0} / 5`}
              status={
                (kpi.huddles_complete_this_week ?? 0) >= 5 ? 'on_target' :
                (kpi.huddles_complete_this_week ?? 0) >= 3 ? 'below_target' : 'critical'
              }
              subtext="This week"
            />
            <KpiCard
              label="Charts Not Closed"
              value={fmt(kpi.charts_not_closed_week, 'number')}
              target="0"
              status={
                (kpi.charts_not_closed_week ?? 0) === 0 ? 'on_target' :
                (kpi.charts_not_closed_week ?? 0) <= 3 ? 'below_target' : 'critical'
              }
              subtext="Running total this week"
            />
            <KpiCard
              label="Claims Not Submitted"
              value={fmt(kpi.claims_not_submitted_week, 'number')}
              target="0"
              status={
                (kpi.claims_not_submitted_week ?? 0) === 0 ? 'on_target' :
                (kpi.claims_not_submitted_week ?? 0) <= 3 ? 'below_target' : 'critical'
              }
              subtext="Running total this week"
            />
            <KpiCard
              label="All Issues Have Owners"
              value={kpi.latest_all_issues_have_owners === null ? 'N/A' : kpi.latest_all_issues_have_owners ? 'Yes ✓' : 'No ✗'}
              status={
                kpi.latest_all_issues_have_owners === null ? 'na' :
                kpi.latest_all_issues_have_owners ? 'on_target' : 'critical'
              }
              subtext="Most recent huddle"
            />
          </div>
        </div>

        {/* Threshold Reference */}
        <details className="mt-4 text-xs">
          <summary className="text-[#c4b49a]/50 cursor-pointer hover:text-[#c4b49a] transition-colors">
            Threshold Reference (HealthE targets)
          </summary>
          <div className="mt-2 border border-[#2e2016] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#2e2016]/50">
                <tr>
                  <th className="text-left p-2 text-[#c4b49a]/70 font-medium">Metric</th>
                  <th className="text-left p-2 text-emerald-400/70 font-medium">On Target</th>
                  <th className="text-left p-2 text-red-400/70 font-medium">Threshold Alert</th>
                  <th className="text-left p-2 text-[#c4b49a]/70 font-medium">Required Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2016]">
                {[
                  { metric: 'Charge Lag', target: '<24 hours', alert: '>48 hours', action: 'Mykael notifies Dr. Akita same day. Chart identified and closed immediately.' },
                  { metric: 'Collections Rate', target: '≥95%', alert: '<85%', action: 'Mykael presents full AR recovery plan at Monday review.' },
                  { metric: 'Denial Rate', target: '<5%', alert: '>10%', action: 'Mykael pulls denial log. Root cause identified and correction starts same week.' },
                  { metric: 'AR 90+ Days', target: '<5% of AR', alert: '>10% of AR', action: 'Each account named individually at Monday review. Decision: appeal, write-off, or plan.' },
                  { metric: 'Notes Closed Same Day', target: '100%', alert: 'Any miss', action: 'Chart identified and closed before Monday review ends. Mykael notified to submit claim.' },
                ].map(row => (
                  <tr key={row.metric} className="hover:bg-[#2e2016]/30 transition-colors">
                    <td className="p-2 text-white font-medium">{row.metric}</td>
                    <td className="p-2 text-emerald-400">{row.target}</td>
                    <td className="p-2 text-red-400">{row.alert}</td>
                    <td className="p-2 text-[#c4b49a]">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner']}>
      <DashboardInner />
    </RoleGuard>
  )
}