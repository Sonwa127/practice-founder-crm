'use client'

/**
 * Practice Founder CRM — KPI Dashboard (v4 — FINAL)
 * Self-contained: no useOrgUser / AccessGuard imports.
 * Column names match verified DB schema.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardSummary {
  org_id: string
  revenue_collected: number | null
  prev_revenue: number | null
  revenue_wow_pct: number | null
  collection_rate: number | null
  total_collections: number | null
  denial_rate_pct: number | null
  charge_lag_within_24hr_pct: number | null
  denials_still_open: number | null
  denials_resolved: number | null
  payroll_pct_of_revenue: number | null
  owner_pay_distributed: boolean | null
  owner_pay_for_week: number | null
  week_start: string | null
  week_end: string | null
  notes_closed_same_day_pct: number | null
  referral_completion_rate: number | null
  task_completion_rate_pct: number | null
  completed_tasks: number | null
  total_active_tasks: number | null
}

interface SparkPoint {
  week_start: string
  revenue_collected: number
}

// ─── Inline org + access hook ─────────────────────────────────────────────────

function useOrgAccess() {
  const supabase = createClient()
  const [state, setState] = useState<{
    orgId: string | null
    hasAccess: boolean
    loading: boolean
  }>({ orgId: null, hasAccess: false, loading: true })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setState({ orgId: null, hasAccess: false, loading: false }); return }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.org_id) { setState({ orgId: null, hasAccess: false, loading: false }); return }

      // pf_admin and pf_team have platform-level access — never blocked by client flags
      const isPlatformAdmin = profile.role === 'pf_admin' || profile.role === 'pf_team'
      if (isPlatformAdmin) {
        setState({ orgId: profile.org_id, hasAccess: true, loading: false })
        return
      }

      const { data: emp } = await supabase
        .from('employees')
        .select('dashboard_access')
        .eq('org_id', profile.org_id)
        .eq('email', user.email ?? '')
        .maybeSingle()

      setState({
        orgId: profile.org_id,
        hasAccess: emp?.dashboard_access === true,
        loading: false,
      })
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

// ─── Status logic ─────────────────────────────────────────────────────────────

type MetricStatus = 'on-target' | 'below-target' | 'critical' | 'no-data'

function getStatus(
  value: number | null | undefined,
  thresholds: { onTarget: (v: number) => boolean; critical: (v: number) => boolean }
): MetricStatus {
  if (value === null || value === undefined) return 'no-data'
  if (thresholds.critical(value)) return 'critical'
  if (thresholds.onTarget(value)) return 'on-target'
  return 'below-target'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtShort(iso: string) {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  catch { return iso }
}
function fmtLong(iso: string) {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}
const fmt = {
  pct:    (v: number | null) => v !== null ? `${v}%` : null,
  dollar: (v: number | null) => v !== null ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null,
  bool:   (v: boolean | null) => v === null ? null : v ? 'Yes' : 'No',
}

// ─── UI components ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<MetricStatus, { label: string; dot: string; badge: string }> = {
  'on-target':    { label: 'On Target',    dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  'below-target': { label: 'Below Target', dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border border-amber-400/20' },
  'critical':     { label: 'Critical',     dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  'no-data':      { label: 'No Data',      dot: 'bg-neutral-600', badge: 'bg-neutral-700/50 text-neutral-500 border border-neutral-700' },
}

function StatusBadge({ status }: { status: MetricStatus }) {
  const { label, dot, badge } = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span>{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#c8843a]">{title}</h2>
    </div>
  )
}

function KpiCard({ label, owner, value, valueNote, prior, target, status, alert, children }: {
  label: string; owner: string; value: string | null; valueNote?: string
  prior?: string | null; target: string; status: MetricStatus; alert?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${
      status === 'critical'      ? 'border-red-500/40 bg-red-950/20'
      : status === 'below-target' ? 'border-amber-400/30 bg-amber-950/10'
      : 'border-[#2e2016] bg-[#1f1a14]'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[#c4b49a] text-sm font-medium leading-snug">{label}</p>
          <p className="text-[#7a6a56] text-xs mt-0.5">Owner: {owner}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-white tabular-nums leading-none">{value ?? '—'}</span>
        {valueNote && <span className="text-sm text-[#7a6a56] mb-0.5">{valueNote}</span>}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-[#7a6a56]">
        {prior !== undefined && <span>Prior: <span className="text-[#c4b49a]">{prior ?? '—'}</span></span>}
        <span>Target: <span className="text-[#c4b49a]">{target}</span></span>
      </div>
      {children}
      {(status === 'critical' || status === 'below-target') && alert && (
        <div className={`flex items-start gap-2 rounded-lg p-2.5 ${
          status === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-400/10 border border-amber-400/20'
        }`}>
          <span className={`text-xs mt-0.5 ${status === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
            {status === 'critical' ? '⚠' : '↓'}
          </span>
          <p className={`text-xs leading-snug ${status === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{alert}</p>
        </div>
      )}
    </div>
  )
}

function RevenueTrendChart({ data }: { data: SparkPoint[] }) {
  const chartData = [...data].slice(0, 8).reverse().map(d => ({
    week: fmtShort(d.week_start),
    revenue: Number(d.revenue_collected),
  }))
  return (
    <div className="h-20 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#7a6a56' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#1f1a14', border: '1px solid #2e2016', borderRadius: 8, fontSize: 12, color: '#c4b49a' }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue'] as [string, string]}
          />
          <Line type="monotone" dataKey="revenue" stroke="#c8843a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#c8843a' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 rounded-full border-2 border-[#c8843a] border-t-transparent animate-spin" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#2e2016] flex items-center justify-center text-2xl">📊</div>
      <p className="text-[#c4b49a] font-medium">No data yet</p>
      <p className="text-[#7a6a56] text-sm max-w-xs">
        Dashboard populates once daily billing, weekly financials, and daily tracker data have been entered.
      </p>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#2e2016] flex items-center justify-center text-2xl">🔒</div>
      <p className="text-[#c4b49a] font-medium">Access restricted</p>
      <p className="text-[#7a6a56] text-sm max-w-xs">You need dashboard access to view this page. Contact your practice manager.</p>
    </div>
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent({ orgId }: { orgId: string }) {
  const supabase = createClient()

  const { data: summary, isLoading } = useQuery<DashboardSummary | null>({
    queryKey: ['dashboard-summary', orgId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_summary')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: sparkData } = useQuery<SparkPoint[]>({
    queryKey: ['dashboard-sparkline', orgId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_revenue_sparkline')
        .select('week_start, revenue_collected')
        .eq('org_id', orgId)
        .order('week_start', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as SparkPoint[]
    },
  })

  if (isLoading) return <Spinner />
  if (!summary)  return <EmptyState />

  const s = summary

  const revenueStatus     = getStatus(s.revenue_wow_pct,            { onTarget: v => v >= -10, critical: v => v <= -20 })
  const collectionsStatus = getStatus(s.collection_rate,            { onTarget: v => v >= 95,  critical: v => v < 85 })
  const denialStatus      = getStatus(s.denial_rate_pct,            { onTarget: v => v < 5,    critical: v => v > 10 })
  const chargelagStatus   = getStatus(s.charge_lag_within_24hr_pct, { onTarget: v => v >= 95,  critical: v => v < 70 })
  const notesStatus       = getStatus(s.notes_closed_same_day_pct,  { onTarget: v => v >= 100, critical: v => v < 90 })
  const referralStatus    = getStatus(s.referral_completion_rate,   { onTarget: v => v >= 100, critical: v => v < 85 })
  const taskStatus        = getStatus(s.task_completion_rate_pct,   { onTarget: v => v >= 95,  critical: v => v < 80 })
  const payrollStatus     = getStatus(s.payroll_pct_of_revenue,     { onTarget: v => v <= 40,  critical: v => v > 55 })

  const arTotal   = (s.denials_still_open ?? 0) + (s.denials_resolved ?? 0)
  const arOpenPct = arTotal > 0 ? Math.round(((s.denials_still_open ?? 0) / arTotal) * 100) : null
  const arStatus  = getStatus(arOpenPct, { onTarget: v => v < 5, critical: v => v > 10 })

  const ownerStatus: MetricStatus = s.owner_pay_distributed === null ? 'no-data'
    : s.owner_pay_distributed ? 'on-target' : 'critical'

  const allStatuses = [revenueStatus, collectionsStatus, denialStatus, chargelagStatus,
    arStatus, notesStatus, referralStatus, taskStatus, payrollStatus, ownerStatus]
  const criticalCount = allStatuses.filter(x => x === 'critical').length
  const belowCount    = allStatuses.filter(x => x === 'below-target').length
  const overall       = criticalCount > 0 ? 'critical' : belowCount > 0 ? 'below-target' : 'on-target'
  const overallLabel  = overall === 'critical' ? '🔴 Red — Threshold alert triggered'
    : overall === 'below-target' ? '🟡 Amber — Metrics below target' : '🟢 Green — All metrics on target'

  return (
    <div className="space-y-8">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly KPI Dashboard</h1>
          <p className="text-[#7a6a56] text-sm mt-0.5">Monday review · Dr. Akita &amp; Mykael</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          overall === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
          : overall === 'below-target' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>{overallLabel}</div>
      </div>

      {s.week_start && s.week_end && (
        <div className="flex items-center gap-2 text-xs text-[#7a6a56] bg-[#1f1a14] border border-[#2e2016] rounded-lg px-3 py-2">
          <span className="text-[#c8843a]">📅</span>
          <span>Week of <span className="text-[#c4b49a] font-medium">{fmtShort(s.week_start)}–{fmtLong(s.week_end)}</span> · Latest submitted records</span>
        </div>
      )}

      <section>
        <SectionHeader title="Revenue" icon="💰" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Revenue Collected" owner="Mykael"
            value={fmt.dollar(s.revenue_collected)} prior={fmt.dollar(s.prev_revenue)}
            valueNote={s.revenue_wow_pct !== null ? `${s.revenue_wow_pct >= 0 ? '+' : ''}${s.revenue_wow_pct}% WoW` : undefined}
            target="Track vs. prior week" status={revenueStatus}
            alert="Revenue down >20% WoW. Compare to same week prior month and flag.">
            {sparkData && sparkData.length > 1 && <RevenueTrendChart data={sparkData} />}
          </KpiCard>
          <KpiCard label="Collections Rate" owner="Mykael"
            value={fmt.pct(s.collection_rate)} target="≥ 95%" status={collectionsStatus}
            alert="Below 95% — Mykael identifies gap claims at Monday review." />
        </div>
      </section>

      <section>
        <SectionHeader title="Billing" icon="🧾" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Charge Lag — Claims Within 24 Hrs" owner="Mykael"
            value={fmt.pct(s.charge_lag_within_24hr_pct)} target="< 24 hrs (> 95% of claims)"
            status={chargelagStatus} alert="Any claim > 48 hrs: identify chart and cause. Correct same week." />
          <KpiCard label="Denial Rate" owner="Mykael"
            value={fmt.pct(s.denial_rate_pct)} target="< 5%" status={denialStatus}
            alert="> 10% triggers root cause analysis. Same pattern twice = process fix." />
        </div>
      </section>

      <section>
        <SectionHeader title="Accounts Receivable" icon="📋" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Open Denials (% of AR)" owner="Mykael"
            value={fmt.pct(arOpenPct)}
            valueNote={s.denials_still_open !== null ? `${s.denials_still_open} open` : undefined}
            target="< 5% of AR" status={arStatus}
            alert="> 10%: each account named. Decision required: appeal / write-off / plan." />
          <KpiCard label="Denial Resubmission" owner="Mykael"
            value={s.denials_resolved !== null ? `${s.denials_resolved} resolved` : null}
            valueNote={s.denials_still_open !== null ? `${s.denials_still_open} still open` : undefined}
            target="< 3 business days" status={arStatus}
            alert="Any denial > 3 days without resubmission: flag immediately." />
        </div>
      </section>

      <section>
        <SectionHeader title="Operations" icon="⚙️" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="Notes Closed Same Day" owner="Dr. Akita"
            value={fmt.pct(s.notes_closed_same_day_pct)} target="100%" status={notesStatus}
            alert="Any miss: chart named and closed before Monday review ends." />
          <KpiCard label="Referral Completion Rate" owner="Danna"
            value={fmt.pct(s.referral_completion_rate)} target="100% tracked" status={referralStatus}
            alert="Any untracked referral: Danna closes gap before EOD Monday." />
          <KpiCard label="Task Completion Rate" owner="Danna"
            value={fmt.pct(s.task_completion_rate_pct)}
            valueNote={s.completed_tasks != null && s.total_active_tasks != null
              ? `${s.completed_tasks}/${s.total_active_tasks} tasks` : undefined}
            target="> 95%" status={taskStatus}
            alert="Below 95%: Danna identifies pattern at Tuesday huddle." />
        </div>
      </section>

      <section>
        <SectionHeader title="Payroll &amp; Owner Draw" icon="💼" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Payroll as % of Collected Revenue" owner="Dr. Akita"
            value={fmt.pct(s.payroll_pct_of_revenue)} target="Typically ≤ 40%" status={payrollStatus}
            alert="Rising payroll % over 3+ consecutive weeks requires a staffing structure review." />
          <KpiCard label="Owner Draw — On Schedule?" owner="Dr. Akita"
            value={fmt.bool(s.owner_pay_distributed)}
            valueNote={s.owner_pay_for_week ? `${fmt.dollar(s.owner_pay_for_week)} this week` : undefined}
            target="Yes — on schedule every week" status={ownerStatus}
            alert="Owner draw missed. Identify which transfer was missed and confirm catch-up date." />
        </div>
      </section>

      {criticalCount > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400">⚠</span>
            <h3 className="text-sm font-semibold text-red-400">
              {criticalCount} Threshold Alert{criticalCount > 1 ? 's' : ''} — Immediate Action Required
            </h3>
          </div>
          <p className="text-red-300/80 text-xs leading-relaxed">
            These metrics require action today — not at the next Monday review.
          </p>
        </div>
      )}

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { orgId, hasAccess, loading } = useOrgAccess()
  if (loading)    return <div className="p-6"><Spinner /></div>
  if (!hasAccess) return <div className="p-6 max-w-5xl mx-auto"><AccessDenied /></div>
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <DashboardContent orgId={orgId!} />
    </div>
  )
}