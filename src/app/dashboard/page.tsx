'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import RoleGuard from '@/components/RoleGuard';
import {
  TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle,
  CheckCircle, Clock, Users, Activity, BarChart3, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'overview' | 'financial' | 'clinical' | 'operations';
type DateRange = '7d' | '30d' | '90d' | 'ytd';

// ─── Demo data ────────────────────────────────────────────────────────────────

const REVENUE_TREND = [
  { week: 'Mar 10', revenue: 21000, payroll: 6500, labour: 7300 },
  { week: 'Mar 17', revenue: 22500, payroll: 6500, labour: 7300 },
  { week: 'Mar 24', revenue: 23000, payroll: 6500, labour: 7300 },
  { week: 'Mar 31', revenue: 24500, payroll: 6500, labour: 7300 },
  { week: 'Apr 7',  revenue: 22400, payroll: 6500, labour: 7300 },
  { week: 'Apr 14', revenue: 25300, payroll: 6500, labour: 7300 },
];

const DENIAL_TREND = [
  { date: 'Apr 15', rate: 11.11, denied: 2 },
  { date: 'Apr 16', rate: 6.67,  denied: 1 },
  { date: 'Apr 17', rate: 18.18, denied: 4 },
  { date: 'Apr 18', rate: 15.0,  denied: 3 },
  { date: 'Apr 19', rate: 5.88,  denied: 1 },
  { date: 'Apr 20', rate: 9.52,  denied: 2 },
  { date: 'Apr 21', rate: 10.53, denied: 2 },
];

const VISIT_MIX = [
  { name: 'Annual Wellness Visit', value: 18, color: '#c8843a' },
  { name: 'Follow-Up Visits',      value: 45, color: '#d9944a' },
  { name: 'Telehealth',            value: 22, color: '#e8a05a' },
  { name: 'New Patient',           value: 14, color: '#a06028' },
  { name: 'Well Woman',            value: 12, color: '#7a4820' },
  { name: 'IV Therapy',            value: 11, color: '#f0b070' },
  { name: 'Other',                 value: 10, color: '#5a3818' },
];

const COLLECTION_TREND = [
  { date: 'Apr 15', rate: 57.1,  total: 2100 },
  { date: 'Apr 16', rate: 62.3,  total: 2380 },
  { date: 'Apr 17', rate: 48.9,  total: 1860 },
  { date: 'Apr 18', rate: 71.2,  total: 2710 },
  { date: 'Apr 19', rate: 72.1,  total: 2810 },
  { date: 'Apr 20', rate: 43.2,  total: 2050 },
  { date: 'Apr 21', rate: 57.8,  total: 2370 },
];

const CHARTS_TREND = [
  { date: 'Apr 15', completed: 18, same_day: 16, pending: 2 },
  { date: 'Apr 16', completed: 15, same_day: 15, pending: 0 },
  { date: 'Apr 17', completed: 22, same_day: 19, pending: 3 },
  { date: 'Apr 18', completed: 20, same_day: 18, pending: 2 },
  { date: 'Apr 19', completed: 19, same_day: 18, pending: 1 },
  { date: 'Apr 20', completed: 21, same_day: 20, pending: 1 },
  { date: 'Apr 21', completed: 17, same_day: 15, pending: 2 },
];

const OPEN_ISSUES = [
  { id: '1', name: 'Insurance delay on 3 pending claims', impact: 'High',   area: 'Revenue Cycle', age: '3 days' },
  { id: '2', name: 'MA role unfilled — productivity gap', impact: 'High',   area: 'Staffing',      age: '5 days' },
  { id: '3', name: 'Prior auth backlog — 8 outstanding',  impact: 'Medium', area: 'Clinical',      age: '2 days' },
  { id: '4', name: 'Billing SOP needs update',            impact: 'Low',    area: 'Operations',    age: '7 days' },
];

const RECENT_HUDDLE = {
  date: 'Apr 21, 2026',
  charts_not_closed: 2,
  claims_not_submitted: 1,
  issues_assigned: 3,
  all_have_owners: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const impactColor = (i: string) => ({
  'Critical': { bg: '#450a0a', text: '#f87171', border: '#7f1d1d' },
  'High':     { bg: '#3d1a00', text: '#fb923c', border: '#7c3400' },
  'Medium':   { bg: '#3d2d00', text: '#fbbf24', border: '#7c5c00' },
  'Low':      { bg: '#14532d', text: '#4ade80', border: '#166534' },
}[i] ?? { bg: '#1f2937', text: '#9ca3af', border: '#374151' });

const trendIcon = (val: number, inverted = false) => {
  if (val === 0) return <Minus className="w-3.5 h-3.5 text-[#6b5a47]" />;
  const up = val > 0;
  const good = inverted ? !up : up;
  return good
    ? <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
    : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />;
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e1409] border border-[#3a2a1a] rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-[#a08060] mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold ml-1">
            {typeof p.value === 'number' &&
              (p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('payroll') ||
               p.name?.toLowerCase().includes('labour') || p.name?.toLowerCase().includes('total'))
              ? fmtUSD(p.value)
              : typeof p.value === 'number' && (p.name?.includes('rate') || p.name?.includes('Rate'))
              ? `${p.value.toFixed(1)}%`
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trend, trendLabel, icon: Icon, accent, inverted,
}: {
  label: string; value: string; sub?: string; trend?: number; trendLabel?: string;
  icon: React.ElementType; accent?: string; inverted?: boolean;
}) {
  const trendGood = trend !== undefined ? (inverted ? trend < 0 : trend > 0) : null;
  return (
    <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl p-4 flex flex-col gap-3 hover:border-[#3a2a1a] transition">
      <div className="flex items-start justify-between">
        <p className="text-xs text-[#6b5a47] uppercase tracking-wider font-medium">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: (accent ?? '#c8843a') + '20' }}>
          <Icon className="w-4 h-4" style={{ color: accent ?? '#c8843a' }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs text-[#6b5a47] mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {trendIcon(trend, inverted)}
          <span style={{ color: trendGood ? '#4ade80' : '#f87171' }}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          {trendLabel && <span className="text-[#6b5a47]">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1e1409] border border-[#2e2016] rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {subtitle && <p className="text-xs text-[#6b5a47] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── View tabs ────────────────────────────────────────────────────────────────

const VIEWS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'overview',   label: 'Overview',         icon: Activity   },
  { key: 'financial',  label: 'Financial Tracker', icon: DollarSign },
  { key: 'clinical',   label: 'Clinical KPIs',     icon: Users      },
  { key: 'operations', label: 'Operations',        icon: BarChart3  },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { orgId, employeeName } = useOrgUser();
  const [view,        setView]        = useState<ViewMode>('overview');
  const [dateRange,   setDateRange]   = useState<DateRange>('30d');
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setLastUpdated(new Date()); }, 800);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[#2e2016]">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-[#6b5a47]">{greeting()}, {employeeName ?? 'Dr. Evans'}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">Practice Dashboard</h1>
            <p className="text-xs text-[#6b5a47] mt-1">
              Last updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#3a2a1a] rounded-lg overflow-hidden">
              {(['7d','30d','90d','ytd'] as DateRange[]).map(r => (
                <button key={r} onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium transition
                    ${dateRange === r ? 'bg-[#c8843a]/20 text-[#e8a05a]' : 'bg-[#221710] text-[#6b5a47] hover:text-[#a08060]'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3a2a1a] bg-[#221710] text-[#a08060] hover:border-[#c8843a]/60 text-xs transition">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 mt-4">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${view === v.key
                  ? 'bg-[#c8843a] text-white shadow-lg shadow-[#c8843a]/20'
                  : 'text-[#6b5a47] hover:text-[#a08060] hover:bg-[#221710]'}`}>
              <v.icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">

        {/* OVERVIEW */}
        {view === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Revenue This Week"     value={fmtUSD(25300)} sub="Week of Apr 14"      trend={12.9}  trendLabel="vs last week" icon={DollarSign} />
              <StatCard label="Denial Rate Today"     value="10.53%"        sub="2 of 19 claims"      trend={1.01}  trendLabel="vs yesterday" icon={AlertTriangle} accent="#f87171" inverted />
              <StatCard label="Collection Rate"       value="57.8%"         sub="Apr 21"              trend={14.6}  trendLabel="vs yesterday" icon={TrendingUp}   accent="#4ade80" />
              <StatCard label="Payroll % Revenue"     value="25.69%"        sub="Week of Apr 14"      trend={-3.33} trendLabel="vs last week" icon={Users}        accent="#60a5fa" inverted />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Charts Pending"        value="2"             sub="from prior days"     trend={-1}    trendLabel="vs yesterday" icon={FileText}     accent="#fbbf24" inverted />
              <StatCard label="Open Issues"           value="4"             sub="across all areas"    icon={AlertTriangle} accent="#fb923c" />
              <StatCard label="Referral Rate"         value="21.05%"        sub="4 of 19 patients"    trend={6.76}  trendLabel="vs yesterday" icon={Activity}     accent="#a78bfa" />
              <StatCard label="Owner Pay On Schedule" value="Yes"           sub="Week of Apr 14"      icon={CheckCircle} accent="#4ade80" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Revenue Collected" subtitle="Weekly trend">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={REVENUE_TREND}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#c8843a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#c8843a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="week" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#c8843a" strokeWidth={2} fill="url(#revGrad)" />
                    <Line type="monotone" dataKey="labour"  name="Labour Costs" stroke="#6b5a47" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Denial Rate" subtitle="Daily trend — lower is better">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={DENIAL_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="date" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rate" name="Denial Rate" radius={[3,3,0,0]}>
                      {DENIAL_TREND.map((entry, i) => (
                        <Cell key={i} fill={entry.rate > 15 ? '#f87171' : entry.rate > 10 ? '#fb923c' : '#fbbf24'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <ChartCard title="Open Issues" subtitle={`${OPEN_ISSUES.length} unresolved`}>
                  <div className="space-y-2">
                    {OPEN_ISSUES.map(issue => {
                      const c = impactColor(issue.impact);
                      return (
                        <div key={issue.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                          style={{ borderColor: c.border + '40', backgroundColor: c.bg + '40' }}>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ color: c.text, backgroundColor: c.bg }}>
                            {issue.impact}
                          </span>
                          <span className="flex-1 text-sm text-[#c4b49a]">{issue.name}</span>
                          <span className="text-xs text-[#6b5a47]">{issue.area}</span>
                          <span className="text-xs text-[#5a4535]">{issue.age}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#5a4535]" />
                        </div>
                      );
                    })}
                  </div>
                </ChartCard>
              </div>

              <ChartCard title="Today's Huddle" subtitle={RECENT_HUDDLE.date}>
                <div className="space-y-3">
                  {[
                    { label: 'Charts not closed yesterday',    value: RECENT_HUDDLE.charts_not_closed,    warn: RECENT_HUDDLE.charts_not_closed > 0 },
                    { label: 'Claims not submitted yesterday', value: RECENT_HUDDLE.claims_not_submitted, warn: RECENT_HUDDLE.claims_not_submitted > 0 },
                    { label: 'Issues assigned today',          value: RECENT_HUDDLE.issues_assigned,      warn: false },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#2e2016] last:border-0">
                      <span className="text-xs text-[#a08060]">{item.label}</span>
                      <span className={`text-sm font-bold ${item.warn ? 'text-yellow-400' : 'text-white'}`}>{item.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-[#a08060]">All issues have owners?</span>
                    <span className={`text-sm font-bold ${RECENT_HUDDLE.all_have_owners ? 'text-green-400' : 'text-red-400'}`}>
                      {RECENT_HUDDLE.all_have_owners ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {/* FINANCIAL */}
        {view === 'financial' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Revenue This Week"     value={fmtUSD(25300)} sub="Apr 14–20"            trend={12.9}  trendLabel="vs prev week" icon={DollarSign} />
              <StatCard label="Payroll % of Revenue"  value="25.69%"        sub="Target: under 30%"    trend={-3.33} trendLabel="vs prev week" icon={Users}       accent="#60a5fa" inverted />
              <StatCard label="Labour Costs"          value={fmtUSD(7300)}  sub="Payroll + Contractor"  icon={Users}  accent="#a78bfa" />
              <StatCard label="Owner Pay Distributed" value="Yes"           sub="Week of Apr 14"        icon={CheckCircle} accent="#4ade80" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Denial Rate Today"  value="10.53%"  sub="2 denied of 19"    trend={1.01}  trendLabel="vs yesterday" icon={AlertTriangle} accent="#f87171" inverted />
              <StatCard label="Claims Paid Today"  value="16"      sub="of 19 submitted"   trend={-5.9}  trendLabel="vs yesterday" icon={CheckCircle}  accent="#4ade80" />
              <StatCard label="Denials Resolved"   value="1"       sub="today"             icon={TrendingUp} accent="#4ade80" />
              <StatCard label="Denials Still Open" value="1"       sub="from prior days"   icon={Clock}  accent="#fbbf24" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Weekly Revenue vs Labour Costs" subtitle="6-week comparison">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={REVENUE_TREND} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="week" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Revenue"      fill="#c8843a" radius={[3,3,0,0]} />
                    <Bar dataKey="labour"  name="Labour Costs" fill="#3a2a1a" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Payroll as % of Revenue" subtitle="Weekly — target under 30%">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={REVENUE_TREND.map(r => ({ ...r, pct: parseFloat(((r.payroll / r.revenue) * 100).toFixed(2)) }))}>
                    <defs>
                      <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="week" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 40]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey={() => 30} name="Target (30%)" stroke="#f87171" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Area type="monotone" dataKey="pct" name="Payroll %" stroke="#60a5fa" strokeWidth={2} fill="url(#pctGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Daily Denial Rate Trend" subtitle="Last 7 days — target under 10%">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={DENIAL_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                  <XAxis dataKey="date" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" name="Denial Rate" radius={[3,3,0,0]}>
                    {DENIAL_TREND.map((entry, i) => (
                      <Cell key={i} fill={entry.rate > 15 ? '#f87171' : entry.rate > 10 ? '#fb923c' : '#4ade80'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {/* CLINICAL */}
        {view === 'clinical' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Collection Rate Today"    value="57.8%"  sub="Apr 21"           trend={14.6}  trendLabel="vs yesterday" icon={TrendingUp}    accent="#4ade80" />
              <StatCard label="Referral Completion Rate" value="21.05%" sub="4 of 19 patients" trend={6.76}  trendLabel="vs yesterday" icon={Activity}      accent="#a78bfa" />
              <StatCard label="Charts Pending"           value="2"      sub="from prior days"  trend={1}     trendLabel="vs yesterday" icon={FileText}       accent="#fbbf24" inverted />
              <StatCard label="Notes Signed Today"       value="Yes"    sub="All charts signed" icon={CheckCircle} accent="#4ade80" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Patients Seen Today"    value="19"  sub="Apr 21"        icon={Users}         accent="#c8843a" />
              <StatCard label="Charts Closed Same Day" value="15"  sub="of 17 completed" icon={CheckCircle} accent="#4ade80" />
              <StatCard label="No-Shows Today"         value="2"   sub="Apr 21"        icon={AlertTriangle} accent="#f87171" />
              <StatCard label="Referrals Today"        value="4"   sub="Apr 21"        icon={Activity}      accent="#60a5fa" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Collection Rate" subtitle="Daily — target 60%+">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={COLLECTION_TREND}>
                    <defs>
                      <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="date" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey={() => 60} name="Target (60%)" stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 2" dot={false} />
                    <Area type="monotone" dataKey="rate" name="Collection Rate" stroke="#4ade80" strokeWidth={2} fill="url(#collGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Visit Type Mix" subtitle="Last 7 days">
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={VISIT_MIX} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                        {VISIT_MIX.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} visits`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {VISIT_MIX.map(v => (
                      <div key={v.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="text-xs text-[#a08060] flex-1 truncate">{v.name}</span>
                        <span className="text-xs font-semibold text-white">{v.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            </div>

            <ChartCard title="Charts Completed vs Pending" subtitle="Daily breakdown">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={CHARTS_TREND} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                  <XAxis dataKey="date" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="completed" name="Charts Completed" fill="#c8843a" radius={[3,3,0,0]} />
                  <Bar dataKey="same_day"  name="Closed Same Day"  fill="#4ade80" radius={[3,3,0,0]} />
                  <Bar dataKey="pending"   name="Pending"          fill="#f87171" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {/* OPERATIONS */}
        {view === 'operations' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Open Issues"        value="4"   sub="2 high priority" icon={AlertTriangle} accent="#fb923c" />
              <StatCard label="Schedule On Target" value="4/5" sub="days this week"  icon={CheckCircle}   accent="#4ade80" />
              <StatCard label="Staffing Gap Days"  value="1"   sub="this week"       icon={Users}         accent="#f87171" />
              <StatCard label="No-Shows This Week" value="9"   sub="5 days"          icon={Activity}      accent="#fbbf24" />
            </div>

            <ChartCard title="Open Issues" subtitle="All unresolved — sorted by impact">
              <div className="space-y-2 mt-1">
                {OPEN_ISSUES.map(issue => {
                  const c = impactColor(issue.impact);
                  return (
                    <div key={issue.id} className="flex items-center gap-3 px-3 py-3 rounded-lg border transition hover:border-[#3a2a1a]"
                      style={{ borderColor: c.border + '40', backgroundColor: c.bg + '30' }}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full min-w-[60px] text-center"
                        style={{ color: c.text, backgroundColor: c.bg }}>
                        {issue.impact}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-[#c4b49a] font-medium">{issue.name}</p>
                        <p className="text-xs text-[#6b5a47] mt-0.5">{issue.area}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6b5a47]">Open for</p>
                        <p className="text-xs font-semibold text-[#a08060]">{issue.age}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Latest Huddle Log" subtitle={RECENT_HUDDLE.date}>
                <div className="space-y-0">
                  {[
                    { label: 'Charts not closed yesterday',    value: RECENT_HUDDLE.charts_not_closed,    color: RECENT_HUDDLE.charts_not_closed > 0 ? '#fbbf24' : '#4ade80' },
                    { label: 'Claims not submitted yesterday', value: RECENT_HUDDLE.claims_not_submitted, color: RECENT_HUDDLE.claims_not_submitted > 0 ? '#fbbf24' : '#4ade80' },
                    { label: 'Issues assigned today',          value: RECENT_HUDDLE.issues_assigned,      color: '#c4b49a' },
                    { label: 'All issues have owners',         value: RECENT_HUDDLE.all_have_owners ? 'Yes' : 'No', color: RECENT_HUDDLE.all_have_owners ? '#4ade80' : '#f87171' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-[#2e2016] last:border-0">
                      <span className="text-sm text-[#a08060]">{item.label}</span>
                      <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard title="No-Shows & Reschedules" subtitle="Last 7 days">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { date: 'Apr 15', no_shows: 1, reschedules: 2 },
                    { date: 'Apr 16', no_shows: 0, reschedules: 1 },
                    { date: 'Apr 17', no_shows: 3, reschedules: 0 },
                    { date: 'Apr 18', no_shows: 2, reschedules: 3 },
                    { date: 'Apr 19', no_shows: 3, reschedules: 0 },
                    { date: 'Apr 20', no_shows: 1, reschedules: 2 },
                    { date: 'Apr 21', no_shows: 2, reschedules: 1 },
                  ]} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2016" />
                    <XAxis dataKey="date" tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b5a47', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="no_shows"    name="No-Shows"    fill="#f87171" radius={[3,3,0,0]} />
                    <Bar dataKey="reschedules" name="Reschedules" fill="#fbbf24" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Export with RoleGuard ────────────────────────────────────────────────────
// Only dr_evans and operations_manager can access the dashboard.
// All other roles are redirected to /dashboard/tasks.

export default function DashboardPage() {
  return (
    <RoleGuard allow={['dr_evans', 'operations_manager', 'practice_founder', 'practice_manager']}>
      <DashboardContent />
    </RoleGuard>
  );
}