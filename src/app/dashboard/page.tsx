'use client';

// src/app/dashboard/page.tsx
// HealthE Practice — Weekly KPI Dashboard
// Panel A: Revenue, Billing, AR, Operations, Payroll, Membership (15 metrics)
// Panel B: Daily Huddle + Issues (8 metrics)
// Admin-only. Mirrors the HealthE KPI Dashboard doc exactly.

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import RoleGuard from '@/components/RoleGuard';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, XCircle, Clock,
  DollarSign, FileText, Users, Activity,
  BarChart2, Target, Zap, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiValue {
  value: string | number | null;
  raw: number | null;
  trend?: 'up' | 'down' | 'flat';
  status: 'on-target' | 'below' | 'critical' | 'na';
  action?: string;
}

interface DashboardData {
  // Panel A
  revenueCollected:          KpiValue;
  collectionRate:            KpiValue;
  chargeLag:                 KpiValue;
  denialRate:                KpiValue;
  avgDaysInAR:               KpiValue;
  ar90Plus:                  KpiValue;
  denialResubmissionTat:     KpiValue;
  payrollPct:                KpiValue;
  ownerPayOnSchedule:        KpiValue;
  notesClosedSameDay:        KpiValue;
  referralCompletionRate:    KpiValue;
  taskCompletionRate:        KpiValue;
  activeMembersTotal:        KpiValue;
  newMembersThisWeek:        KpiValue;
  membershipRevenue:         KpiValue;
  // Panel B
  openIssuesCount:           KpiValue;
  issuesByImpact:            { low: number; medium: number; high: number; critical: number };
  issuesOpenedThisWeek:      KpiValue;
  issuesResolvedThisWeek:    KpiValue;
  chartsNotClosed:           KpiValue;
  claimsNotSubmitted:        KpiValue;
  huddlesCompletedThisWeek:  { completed: number; outOf: number };
  allIssuesHaveOwners:       KpiValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUSD  = (n: number | null) => n == null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct  = (n: number | null) => n == null ? 'N/A' : `${Number(n).toFixed(1)}%`;
const fmtDays = (n: number | null) => n == null ? 'N/A' : `${Number(n).toFixed(1)} days`;
const fmtNum  = (n: number | null) => n == null ? 'N/A' : String(n);

const STATUS_COLOR: Record<KpiValue['status'], string> = {
  'on-target': 'text-green-400',
  'below':     'text-yellow-400',
  'critical':  'text-red-400',
  'na':        'text-[#6b5a47]',
};
const STATUS_BG: Record<KpiValue['status'], string> = {
  'on-target': 'bg-green-900/20 border-green-800/30',
  'below':     'bg-yellow-900/20 border-yellow-800/30',
  'critical':  'bg-red-900/25 border-red-800/40',
  'na':        'bg-[#1e1409] border-[#2e2016]',
};
const STATUS_LABEL: Record<KpiValue['status'], string> = {
  'on-target': 'On Target',
  'below':     'Below Target',
  'critical':  'CRITICAL',
  'na':        'N/A',
};

function naKpi(): KpiValue {
  return { value: null, raw: null, status: 'na' };
}

// ─── Build dashboard data from Supabase results ───────────────────────────────

function buildDashboard(data: Record<string, unknown[]>): DashboardData {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  // 1A — most recent weekly financial
  const fin = (data.weekly_financial ?? []) as Record<string, number | string | boolean>[];
  const latestFin = fin[0] ?? null;

  const revenueCollected: KpiValue = latestFin
    ? { value: fmtUSD(Number(latestFin.revenue_collected)), raw: Number(latestFin.revenue_collected), status: 'on-target' }
    : naKpi();

  const payrollPct: KpiValue = latestFin && Number(latestFin.revenue_collected) > 0
    ? (() => {
        const pct = (Number(latestFin.payroll_for_the_week) / Number(latestFin.revenue_collected)) * 100;
        return { value: fmtPct(pct), raw: pct, status: pct > 45 ? 'critical' : pct > 35 ? 'below' : 'on-target', action: pct > 45 ? 'Rising payroll % requires staffing structure review.' : undefined };
      })()
    : naKpi();

  const ownerPayOnSchedule: KpiValue = latestFin
    ? { value: latestFin.owner_pay_distributed ? 'Yes' : 'No', raw: latestFin.owner_pay_distributed ? 1 : 0, status: latestFin.owner_pay_distributed ? 'on-target' : 'critical', action: !latestFin.owner_pay_distributed ? 'Identify missed transfer. Confirm catch-up date.' : undefined }
    : naKpi();

  // BA-1 — most recent billing record
  const billing = (data.daily_billing_claims ?? []) as Record<string, number>[];
  const latestBilling = billing[0] ?? null;

  const denialRate: KpiValue = latestBilling && latestBilling.total_claims_submitted > 0
    ? (() => {
        const rate = (latestBilling.total_claims_denied / latestBilling.total_claims_submitted) * 100;
        return { value: fmtPct(rate), raw: rate, status: rate > 10 ? 'critical' : rate > 5 ? 'below' : 'on-target', action: rate > 10 ? 'Pull denial log. Root cause + correction starts this week.' : undefined };
      })()
    : naKpi();

  // BA-2 — charge lag from most recent batch
  const chargeLagRows = (data.charge_lag_submissions ?? []) as Record<string, number | string>[];
  let avgLag: KpiValue = naKpi();
  if (chargeLagRows.length > 0) {
    const latestBatch = chargeLagRows[0]?.batch_name as string;
    const batchRows = chargeLagRows.filter(r => r.batch_name === latestBatch);
    const avg = batchRows.reduce((s, r) => s + Number(r.lag_in_days), 0) / batchRows.length;
    avgLag = {
      value: fmtDays(avg), raw: avg,
      status: avg > 48 ? 'critical' : avg > 24 ? 'below' : 'on-target',
      action: avg > 48 ? 'Identify chart and cause. Correct same week.' : undefined,
    };
  }

  // BA-3 — AR metrics from most recent week
  const arRows = (data.ar_report_submissions ?? []) as Record<string, number | string | null>[];
  let avgDaysInAR: KpiValue = naKpi();
  let ar90Plus: KpiValue = naKpi();
  if (arRows.length > 0) {
    const latestWeekStart = arRows[0]?.week_start as string;
    const weekRows = arRows.filter(r => r.week_start === latestWeekStart);
    const validRows = weekRows.filter(r => r.days_in_ar != null && r.days_in_ar !== '');
    if (validRows.length > 0) {
      const numerator   = validRows.reduce((s, r) => s + Number(r.days_in_ar) * Number(r.ar_balance), 0);
      const denominator = validRows.reduce((s, r) => s + Number(r.ar_balance), 0);
      const weighted    = denominator !== 0 ? Math.round(numerator / denominator) : null;
      avgDaysInAR = { value: weighted != null ? `${weighted} days` : 'N/A', raw: weighted, status: weighted == null ? 'na' : weighted > 60 ? 'critical' : weighted > 30 ? 'below' : 'on-target' };

      const ar90sum = validRows.filter(r => Number(r.days_in_ar) >= 90).reduce((s, r) => s + Number(r.ar_balance), 0);
      const totalAR = weekRows.reduce((s, r) => s + Number(r.ar_balance), 0);
      const pct90   = totalAR > 0 ? (ar90sum / totalAR) * 100 : 0;
      ar90Plus = { value: fmtUSD(ar90sum), raw: ar90sum, status: pct90 > 10 ? 'critical' : pct90 > 5 ? 'below' : 'on-target', action: pct90 > 10 ? 'Each 90+ day account must leave with a decision: appeal, payment plan, or write-off.' : undefined };
    }
  }

  // BA-4 — denial resubmission turnaround from most recent week
  const claimsSummary = (data.weekly_claims_summary ?? []) as Record<string, number | null>[];
  const latestClaims = claimsSummary[0] ?? null;
  const denialResubmissionTat: KpiValue = latestClaims?.avg_resubmission_turnaround != null
    ? (() => {
        const v = Number(latestClaims.avg_resubmission_turnaround);
        return { value: fmtDays(v), raw: v, status: v > 5 ? 'critical' : v > 3 ? 'below' : 'on-target', action: v > 5 ? 'Any denial older than 3 days without resubmission: flag immediately.' : undefined };
      })()
    : naKpi();

  // 1B — collection rate + referral completion rate (most recent)
  const receptionist = (data.daily_tracker_receptionist ?? []) as Record<string, number>[];
  const latestRec = receptionist[0] ?? null;

  const collectionRate: KpiValue = latestRec
    ? (() => {
        const rate = Number(latestRec.collection_rate);
        return { value: fmtPct(rate), raw: rate, status: rate < 85 ? 'critical' : rate < 95 ? 'below' : 'on-target', action: rate < 85 ? 'Mykael presents full AR recovery plan.' : undefined };
      })()
    : naKpi();

  const referralCompletionRate: KpiValue = latestRec
    ? (() => {
        const rate = Number(latestRec.referral_completion_rate);
        return { value: fmtPct(rate), raw: rate, status: rate < 80 ? 'below' : 'on-target' };
      })()
    : naKpi();

  // 1C — notes closed same day (physician)
  const physician = (data.daily_tracker_physician ?? []) as Record<string, number | boolean>[];
  const latestPhys = physician[0] ?? null;
  const notesClosedSameDay: KpiValue = latestPhys
    ? (() => {
        const same  = Number(latestPhys.charts_closed_same_day);
        const total = Number(latestPhys.total_charts_completed);
        const pct   = total > 0 ? (same / total) * 100 : 0;
        const ok    = pct >= 100;
        return { value: `${same}/${total}`, raw: pct, status: ok ? 'on-target' : 'critical', action: !ok ? 'Chart named and closed before Monday review ends.' : undefined };
      })()
    : naKpi();

  // 2A — task completion rate
  const tasks = (data.tasks ?? []) as Record<string, string>[];
  let taskCompletionRate: KpiValue = naKpi();
  if (tasks.length > 0) {
    const complete = tasks.filter(t => t.status === 'Complete').length;
    const pct = (complete / tasks.length) * 100;
    taskCompletionRate = { value: fmtPct(pct), raw: pct, status: pct < 95 ? 'below' : 'on-target' };
  }

  // 1D — membership (most recent week)
  const membership = (data.membership_tracker ?? []) as Record<string, number>[];
  const latestMem = membership[0] ?? null;
  const activeMembersTotal:   KpiValue = latestMem ? { value: fmtNum(latestMem.active_members_total), raw: latestMem.active_members_total, status: 'on-target' } : naKpi();
  const newMembersThisWeek:   KpiValue = latestMem ? { value: fmtNum(latestMem.new_members), raw: latestMem.new_members, status: 'on-target' } : naKpi();
  const membershipRevenue:    KpiValue = latestMem ? { value: fmtUSD(latestMem.membership_revenue), raw: latestMem.membership_revenue, status: 'on-target' } : naKpi();

  // Panel B — huddle + issues
  const issues = (data.issues_breakdowns ?? []) as Record<string, string | number>[];
  const openIssues = issues.filter(i => i.status === 'Open' || i.status === 'Investigating');
  const openIssuesCount: KpiValue = { value: fmtNum(openIssues.length), raw: openIssues.length, status: openIssues.length === 0 ? 'on-target' : openIssues.length > 5 ? 'critical' : 'below' };

  const issuesByImpact = {
    low:      openIssues.filter(i => i.impact_level === 'Low').length,
    medium:   openIssues.filter(i => i.impact_level === 'Medium').length,
    high:     openIssues.filter(i => i.impact_level === 'High').length,
    critical: openIssues.filter(i => i.impact_level === 'Critical').length,
  };

  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const issuesOpenedThisWeek:   KpiValue = { value: fmtNum(issues.filter(i => (i.created_at as string)?.slice(0, 10) >= weekAgoStr).length), raw: null, status: 'na' };
  const issuesResolvedThisWeek: KpiValue = { value: fmtNum(issues.filter(i => ['Resolved', 'Closed'].includes(i.status as string) && (i.updated_at as string)?.slice(0, 10) >= weekAgoStr).length), raw: null, status: 'na' };

  const huddles = (data.daily_huddle_log ?? []) as Record<string, string | number | boolean>[];
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const huddlesThisWeek = huddles.filter(h => (h.date as string) >= weekStartStr);
  const chartsNotClosed:    KpiValue = { value: fmtNum(huddlesThisWeek.reduce((s, h) => s + Number(h.charts_not_closed_yesterday ?? 0), 0)), raw: null, status: 'na' };
  const claimsNotSubmitted: KpiValue = { value: fmtNum(huddlesThisWeek.reduce((s, h) => s + Number(h.claims_not_submitted_yesterday ?? 0), 0)), raw: null, status: 'na' };
  const completedHuddles    = huddlesThisWeek.filter(h => h.huddle_complete).length;
  const huddlesCompletedThisWeek = { completed: completedHuddles, outOf: 5 };

  const latestHuddle = huddles[0] ?? null;
  const allIssuesHaveOwners: KpiValue = latestHuddle
    ? { value: latestHuddle.all_issues_have_owners ? 'Yes' : 'No', raw: latestHuddle.all_issues_have_owners ? 1 : 0, status: latestHuddle.all_issues_have_owners ? 'on-target' : 'critical' }
    : naKpi();

  return {
    revenueCollected, collectionRate, chargeLag: avgLag, denialRate,
    avgDaysInAR, ar90Plus, denialResubmissionTat, payrollPct,
    ownerPayOnSchedule, notesClosedSameDay, referralCompletionRate,
    taskCompletionRate, activeMembersTotal, newMembersThisWeek, membershipRevenue,
    openIssuesCount, issuesByImpact, issuesOpenedThisWeek, issuesResolvedThisWeek,
    chartsNotClosed, claimsNotSubmitted, huddlesCompletedThisWeek, allIssuesHaveOwners,
  };
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, kpi, target, owner, icon: Icon,
}: {
  label: string;
  kpi: KpiValue;
  target?: string;
  owner?: string;
  icon?: React.ElementType;
}) {
  const IconEl = Icon ?? BarChart2;
  const isAlert = kpi.status === 'critical';

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${STATUS_BG[kpi.status]} ${isAlert ? 'ring-1 ring-red-700/50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <IconEl className={`w-3.5 h-3.5 flex-shrink-0 ${STATUS_COLOR[kpi.status]}`} />
          <p className="text-[10px] text-[#a08060] uppercase tracking-widest leading-tight">{label}</p>
        </div>
        {kpi.status !== 'na' && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            kpi.status === 'on-target' ? 'bg-green-900/40 text-green-400'
            : kpi.status === 'below'   ? 'bg-yellow-900/40 text-yellow-400'
            : 'bg-red-900/40 text-red-400 animate-pulse'
          }`}>
            {STATUS_LABEL[kpi.status]}
          </span>
        )}
      </div>

      <p className={`text-2xl font-bold leading-none ${STATUS_COLOR[kpi.status]}`}>
        {kpi.value ?? 'N/A'}
      </p>

      {(target || owner) && (
        <div className="flex items-center gap-2 text-[10px] text-[#5a4535] flex-wrap">
          {target && <span>Target: <span className="text-[#a08060]">{target}</span></span>}
          {owner  && <span>· {owner}</span>}
        </div>
      )}

      {kpi.action && kpi.status !== 'on-target' && (
        <p className="text-[10px] text-red-300 bg-red-900/20 border border-red-800/30 rounded px-2 py-1 leading-tight">
          ⚡ {kpi.action}
        </p>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-[#c8843a]" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#c8843a]">{label}</h2>
      <div className="flex-1 h-px bg-[#2e2016]" />
    </div>
  );
}

// ─── Threshold alert banner ───────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: { label: string; action: string }[] }) {
  if (!alerts.length) return null;
  return (
    <div className="flex-shrink-0 mx-6 mb-3">
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-red-400 uppercase tracking-wide">Threshold Alerts — Requires Immediate Action</span>
        </div>
        <div className="space-y-1">
          {alerts.map((a, i) => (
            <div key={i} className="text-xs text-red-300 flex gap-2">
              <span className="text-red-500">▸</span>
              <span><span className="font-semibold">{a.label}:</span> {a.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { orgId, isLoading: authLoading } = useOrgUser();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const [
        weekly_financial, daily_billing_claims,
        charge_lag_submissions, ar_report_submissions, weekly_claims_summary,
        daily_tracker_receptionist, daily_tracker_physician,
        tasks, membership_tracker, issues_breakdowns, daily_huddle_log,
      ] = await Promise.all([
        supabase.from('weekly_financial_reports').select('*').eq('org_id', orgId).order('week_start', { ascending: false }).limit(4),
        supabase.from('daily_billing_claims').select('*').eq('org_id', orgId).order('date', { ascending: false }).limit(1),
        supabase.from('charge_lag_submissions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
        supabase.from('ar_report_submissions').select('*').eq('org_id', orgId).order('week_start', { ascending: false }).limit(100),
        supabase.from('weekly_claims_summary').select('*').eq('org_id', orgId).order('week_of', { ascending: false }).limit(1),
        supabase.from('daily_tracker_receptionist').select('*').eq('org_id', orgId).order('date', { ascending: false }).limit(7),
        supabase.from('daily_tracker_physician').select('*').eq('org_id', orgId).order('date', { ascending: false }).limit(1),
        supabase.from('tasks').select('id,status').eq('org_id', orgId),
        supabase.from('membership_tracker').select('*').eq('org_id', orgId).order('week_start', { ascending: false }).limit(1),
        supabase.from('issues_breakdowns').select('*').eq('org_id', orgId),
        supabase.from('daily_huddle_log').select('*').eq('org_id', orgId).order('date', { ascending: false }).limit(10),
      ]);

      setLastRefresh(new Date());
      return {
        weekly_financial:          weekly_financial.data ?? [],
        daily_billing_claims:      daily_billing_claims.data ?? [],
        charge_lag_submissions:    charge_lag_submissions.data ?? [],
        ar_report_submissions:     ar_report_submissions.data ?? [],
        weekly_claims_summary:     weekly_claims_summary.data ?? [],
        daily_tracker_receptionist: daily_tracker_receptionist.data ?? [],
        daily_tracker_physician:   daily_tracker_physician.data ?? [],
        tasks:                     tasks.data ?? [],
        membership_tracker:        membership_tracker.data ?? [],
        issues_breakdowns:         issues_breakdowns.data ?? [],
        daily_huddle_log:          daily_huddle_log.data ?? [],
      };
    },
    enabled: !authLoading && !!orgId,
    refetchInterval: 1000 * 60 * 5, // auto-refresh every 5 minutes
  });

  // Use live data or fall back to demo-shaped empty object
  const dash = rawData
    ? buildDashboard(rawData as Record<string, unknown[]>)
    : buildDashboard({
        weekly_financial: [], daily_billing_claims: [], charge_lag_submissions: [],
        ar_report_submissions: [], weekly_claims_summary: [], daily_tracker_receptionist: [],
        daily_tracker_physician: [], tasks: [], membership_tracker: [],
        issues_breakdowns: [], daily_huddle_log: [],
      });

  // Collect threshold alerts
  const alerts: { label: string; action: string }[] = [];
  if (dash.chargeLag.status === 'critical' && dash.chargeLag.action) alerts.push({ label: 'Charge Lag', action: dash.chargeLag.action });
  if (dash.collectionRate.status === 'critical' && dash.collectionRate.action) alerts.push({ label: 'Collection Rate', action: dash.collectionRate.action });
  if (dash.denialRate.status === 'critical' && dash.denialRate.action) alerts.push({ label: 'Denial Rate', action: dash.denialRate.action });
  if (dash.ar90Plus.status === 'critical' && dash.ar90Plus.action) alerts.push({ label: 'AR 90+ Days', action: dash.ar90Plus.action });
  if (dash.notesClosedSameDay.status === 'critical' && dash.notesClosedSameDay.action) alerts.push({ label: 'Notes Closed Same Day', action: dash.notesClosedSameDay.action });

  const overallStatus = alerts.length > 0 ? 'red' : [
    dash.collectionRate, dash.denialRate, dash.payrollPct, dash.ar90Plus,
  ].some(k => k.status === 'below') ? 'amber' : 'green';

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-[#2e2016]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#6b5a47]">Health-E Practice · Weekly KPI Dashboard + Monday Review</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">KPI Dashboard</h1>
            <p className="text-xs text-[#6b5a47] mt-0.5">
              Filled every Monday before 9am review · Confidential · Internal Use Only
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Overall status badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              overallStatus === 'green' ? 'bg-green-900/20 border-green-700/40 text-green-400'
              : overallStatus === 'amber' ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-400'
              : 'bg-red-900/20 border-red-700/40 text-red-400'
            }`}>
              {overallStatus === 'green' && <CheckCircle className="w-4 h-4" />}
              {overallStatus === 'amber' && <AlertCircle className="w-4 h-4" />}
              {overallStatus === 'red'   && <XCircle className="w-4 h-4" />}
              {overallStatus === 'green' ? 'All metrics on target'
               : overallStatus === 'amber' ? '1–2 metrics below target'
               : 'Threshold alert triggered'}
            </div>
            <button onClick={() => refetch()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#3a2a1a] bg-[#221710] text-[#a08060] hover:border-[#c8843a] hover:text-[#e8a05a] text-sm transition">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#4a3828] mt-1">
          Last updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

        {/* Alert banners */}
        <AlertBanner alerts={alerts} />

        {/* ── PANEL A ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-white">Panel A — Weekly KPI Dashboard</h2>
            <span className="text-[10px] text-[#6b5a47]">Numbers that are off target get a decision. Every week.</span>
          </div>

          {/* REVENUE */}
          <div className="mb-4">
            <SectionHead label="Revenue" icon={DollarSign} />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Revenue Collected (cash received)" kpi={dash.revenueCollected}
                target="Track vs. prior week + monthly trend" owner="Mykael" icon={DollarSign} />
              <KpiCard label="Collections Rate (collected vs. charges)" kpi={dash.collectionRate}
                target="≥ 95%" owner="Mykael" icon={Target} />
            </div>
          </div>

          {/* BILLING */}
          <div className="mb-4">
            <SectionHead label="Billing" icon={FileText} />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Charge Lag — avg hours chart to claim" kpi={dash.chargeLag}
                target="< 24 hours" owner="Mykael" icon={Clock} />
              <KpiCard label="Denial Rate (% of claims denied)" kpi={dash.denialRate}
                target="< 5%" owner="Mykael" icon={AlertTriangle} />
            </div>
          </div>

          {/* ACCOUNTS RECEIVABLE */}
          <div className="mb-4">
            <SectionHead label="Accounts Receivable" icon={BarChart2} />
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Average Days in AR" kpi={dash.avgDaysInAR}
                target="< 30 days" owner="Mykael" icon={Clock} />
              <KpiCard label="AR 90+ Days Balance" kpi={dash.ar90Plus}
                target="< 5% of AR" owner="Mykael" icon={AlertTriangle} />
              <KpiCard label="Denial Resubmission Turnaround" kpi={dash.denialResubmissionTat}
                target="< 3 business days" owner="Mykael" icon={RefreshCw} />
            </div>
          </div>

          {/* OPERATIONS */}
          <div className="mb-4">
            <SectionHead label="Operations" icon={Activity} />
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Notes Closed Same Day (%)" kpi={dash.notesClosedSameDay}
                target="100%" owner="Dr. Akita" icon={CheckCircle} />
              <KpiCard label="Referral Completion Rate (%)" kpi={dash.referralCompletionRate}
                target="100% tracked" owner="Front Desk" icon={Users} />
              <KpiCard label="Task Completion Rate (%)" kpi={dash.taskCompletionRate}
                target="> 95%" owner="Front Desk" icon={Zap} />
            </div>
          </div>

          {/* PAYROLL & OWNER DRAW */}
          <div className="mb-4">
            <SectionHead label="Payroll & Owner Draw" icon={DollarSign} />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Payroll as % of Collected Revenue" kpi={dash.payrollPct}
                target="Set at onboarding" owner="Dr. Akita" icon={BarChart2} />
              <KpiCard label="Owner Draw — On Schedule?" kpi={dash.ownerPayOnSchedule}
                target="Yes" owner="Dr. Akita" icon={CheckCircle} />
            </div>
          </div>

          {/* MEMBERSHIP */}
          <div className="mb-4">
            <SectionHead label="Membership" icon={Users} />
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Active Members Total" kpi={dash.activeMembersTotal}
                target="Track trend" owner="Staff" icon={Users} />
              <KpiCard label="New Members This Week" kpi={dash.newMembersThisWeek}
                target="Track trend" owner="Staff" icon={TrendingUp} />
              <KpiCard label="Membership Revenue" kpi={dash.membershipRevenue}
                target="Track trend" owner="Staff" icon={DollarSign} />
            </div>
          </div>
        </section>

        {/* ── PANEL B ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-white">Panel B — Daily Huddle & Issues</h2>
            <span className="text-[10px] text-[#6b5a47]">Operational accountability — reviewed alongside the daily huddle log.</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-3">
            <KpiCard label="Open Issues" kpi={dash.openIssuesCount}
              target="0" icon={AlertTriangle} />
            <KpiCard label="Issues Opened This Week" kpi={dash.issuesOpenedThisWeek}
              icon={TrendingUp} />
            <KpiCard label="Issues Resolved This Week" kpi={dash.issuesResolvedThisWeek}
              icon={CheckCircle} />
            <KpiCard label="All Issues Have Owners (today)" kpi={dash.allIssuesHaveOwners}
              target="Yes" icon={Users} />
          </div>

          <div className="grid grid-cols-4 gap-3 mb-3">
            {/* Issues by impact */}
            <div className="rounded-xl border border-[#2e2016] bg-[#1e1409] p-4 col-span-1">
              <p className="text-[10px] text-[#a08060] uppercase tracking-widest mb-3">Open Issues by Impact</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Critical', count: dash.issuesByImpact.critical, color: 'text-red-400 bg-red-900/20' },
                  { label: 'High',     count: dash.issuesByImpact.high,     color: 'text-orange-400 bg-orange-900/20' },
                  { label: 'Medium',   count: dash.issuesByImpact.medium,   color: 'text-yellow-400 bg-yellow-900/20' },
                  { label: 'Low',      count: dash.issuesByImpact.low,      color: 'text-[#a08060] bg-[#2e2016]' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>{label}</span>
                    <span className="text-sm font-bold text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <KpiCard label="Charts Not Closed (running this week)" kpi={dash.chartsNotClosed} icon={FileText} />
            <KpiCard label="Claims Not Submitted (running this week)" kpi={dash.claimsNotSubmitted} icon={AlertCircle} />

            {/* Huddles completed */}
            <div className="rounded-xl border border-[#2e2016] bg-[#1e1409] p-4">
              <p className="text-[10px] text-[#a08060] uppercase tracking-widest mb-3">Huddles Completed This Week</p>
              <p className="text-3xl font-bold text-white leading-none">
                {dash.huddlesCompletedThisWeek.completed}
                <span className="text-base text-[#6b5a47] font-normal"> / {dash.huddlesCompletedThisWeek.outOf}</span>
              </p>
              <div className="flex gap-1 mt-3">
                {Array.from({ length: dash.huddlesCompletedThisWeek.outOf }, (_, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full ${
                    i < dash.huddlesCompletedThisWeek.completed ? 'bg-green-500' : 'bg-[#2e2016]'
                  }`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Review Checklist ─────────────────────────────────────── */}
        <section>
          <SectionHead label="Monday Review Checklist" icon={CheckCircle} />
          <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl p-4">
            <p className="text-xs text-[#6b5a47] mb-3">The review is not done until every metric has a decision attached.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                'All 6 KPI blocks reviewed',
                'Every off-target metric has a decision',
                'All flags addressed',
                'Open items have owners and deadlines',
                'Ops team notified of any actions',
                'Review complete — sheet filed',
              ].map(item => (
                <ReviewCheckItem key={item} label={item} />
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function ReviewCheckItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <button onClick={() => setChecked(c => !c)}
      className="flex items-center gap-2 text-sm text-left transition hover:text-white">
      {checked
        ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
        : <div className="w-4 h-4 rounded-full border border-[#3a2a1a] flex-shrink-0" />}
      <span className={checked ? 'text-[#a08060] line-through' : 'text-[#c4b49a]'}>{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  return (
    <RoleGuard allow={['admin']}>
      <DashboardContent />
    </RoleGuard>
  );
}