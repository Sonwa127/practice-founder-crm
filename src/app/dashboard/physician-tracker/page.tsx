'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import { useEmployeeNames } from '@/lib/useEmployeeNames';
import { Search, X, Plus, Info, Stethoscope } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PhysicianRow {
  [key: string]: unknown;
  id: string; org_id: string; submitted_by: string; date: string;
  total_patients_encountered: number;
  charts_pending_prior_days: number;
  charts_greater_than_7_days: number;
  charts_closed_same_day: number;
  time_last_chart_closed: string;
  notes_signed_today: boolean;
  schedule_reflected_target: boolean;
  schedule_notes: string;
  staffing_gap: boolean;
  role_impacted: string;
  gap_duration: string;
  tasks_delegatable: string;
  primary_bottleneck: string;
}

const EMPTY_FORM: Record<string, unknown> = {
  submitted_by: '', date: new Date().toISOString().slice(0, 10),
  total_patients_encountered: 0,
  charts_pending_prior_days: 0, charts_greater_than_7_days: 0,
  charts_closed_same_day: 0, time_last_chart_closed: '',
  notes_signed_today: false,
  schedule_reflected_target: false, schedule_notes: '',
  staffing_gap: false, role_impacted: '', gap_duration: '',
  tasks_delegatable: '', primary_bottleneck: '',
};

const DELEGATION_OPTIONS = [
  'Patient phone calls', 'Insurance pre-authorizations', 'Medication refill requests',
  'Lab follow-ups', 'Scheduling issues', 'Administrative paperwork',
  'Staff coordination', 'Other',
];

const BOTTLENECK_OPTIONS = [
  'Charting backlog', 'Staffing gap', 'Schedule not reflecting service mix',
  'Lab or imaging delays', 'Patient late arrivals', 'EHR/system issues',
  'Billing or coding questions', 'Patient complexity', 'Other',
];

const ROLE_OPTIONS = ['MA Role', 'Front Desk Role', 'Billing Role', 'Other'];

const TOOLTIPS: Record<string, string> = {
  total_patients_encountered: 'Total unique patients you personally saw today across all visit types.',
  charts_pending_prior_days: 'Charts from previous days that are still open and have not been fully completed or signed.',
  charts_greater_than_7_days: 'Of your pending charts, how many have been open for MORE than 7 days? These are at risk of causing billing delays.',
  charts_closed_same_day: 'Charts from today\'s visits that were fully completed, signed, and closed before end of day. The goal is same-day closure.',
  time_last_chart_closed: 'The exact time you closed your final chart today. Tracks how late into the evening charting is extending. Goal: close all charts before leaving the office.',
  tasks_delegatable: 'Tasks or actions you personally handled today that a trained staff member could have managed.',
  primary_bottleneck: 'The single main thing that slowed down your day.',
};

// ─── Helper components ────────────────────────────────────────────────────────
function Tip({ field }: { field: string }) {
  const [show, setShow] = useState(false);
  const text = TOOLTIPS[field];
  if (!text) return null;
  return (
    <span className="relative inline-flex ml-1" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info className="w-3 h-3 text-[#6b5a47] cursor-help" />
      {show && (
        <span className="absolute left-5 top-0 z-50 w-64 p-2 text-xs bg-[#2e2016] border border-[#4a3020] rounded-lg text-[#c4b49a] shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

function SectionBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#2a1e10]/60 border border-[#3a2a1a] rounded-lg px-4 py-3 mb-3">
      <div className="text-[#c8843a] text-xs font-bold uppercase tracking-widest mb-0.5">{title}</div>
      <div className="text-[#c4b49a]/60 text-xs">{description}</div>
    </div>
  );
}

const iCls = "w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8843a] transition-colors";
const lCls = "flex items-center text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50 mb-1";

function NInput({ label, field, value, onChange }: { label: string; field: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className={lCls}>{label}<span className="text-[#c8843a] ml-0.5">*</span><Tip field={field} /></label>
      <input type="number" min={0} value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className={iCls} />
    </div>
  );
}

function CheckRow({ label, field, checked, onChange, description }: {
  label: string; field: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-[#3a2a1a] bg-[#1a1410] accent-[#c8843a]" />
      <div>
        <span className="text-sm text-[#c4b49a] group-hover:text-white transition-colors">{label}</span>
        {description && <p className="text-xs text-[#6b5a47] mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_ROWS: PhysicianRow[] = [
  { id:'p1', org_id:'demo', submitted_by:'Physician', date:'2026-05-11',
    total_patients_encountered:18, charts_pending_prior_days:3, charts_greater_than_7_days:1,
    charts_closed_same_day:16, time_last_chart_closed:'2026-05-11T18:30', notes_signed_today:true,
    schedule_reflected_target:true, schedule_notes:'',
    staffing_gap:false, role_impacted:'', gap_duration:'',
    tasks_delegatable:'Lab follow-ups', primary_bottleneck:'Charting backlog' },
  { id:'p2', org_id:'demo', submitted_by:'Physician', date:'2026-05-10',
    total_patients_encountered:21, charts_pending_prior_days:5, charts_greater_than_7_days:2,
    charts_closed_same_day:18, time_last_chart_closed:'2026-05-10T19:45', notes_signed_today:false,
    schedule_reflected_target:false, schedule_notes:'Two IV therapy slots were swapped for follow-ups due to no-shows.',
    staffing_gap:true, role_impacted:'MA Role', gap_duration:'First 2 hours of clinic',
    tasks_delegatable:'Insurance pre-authorizations', primary_bottleneck:'Staffing gap' },
];

// ─── New Physician Form ───────────────────────────────────────────────────────
function NewPhysicianForm({ onSave, onCancel, defaultSubmittedBy }: {
  onSave: (row: PhysicianRow) => void;
  onCancel: () => void;
  defaultSubmittedBy: string;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({ ...EMPTY_FORM, submitted_by: defaultSubmittedBy });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { orgId } = useOrgUser();

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const n = (k: string) => Number(form[k] ?? 0);
  const s = (k: string) => String(form[k] ?? '');
  const b = (k: string) => Boolean(form[k]);

  async function handleSave() {
    if (!s('submitted_by').trim()) { setError('Submitted By is required.'); return; }
    if (!s('date')) { setError('Date is required.'); return; }
    if (n('total_patients_encountered') === 0 && n('charts_closed_same_day') === 0) {
      setError('Please fill in patient and chart data before saving.'); return;
    }
    setError(''); setSaving(true);
    const isDemo = !orgId;
    if (isDemo) {
      onSave({ ...form, id: crypto.randomUUID(), org_id: 'demo' } as PhysicianRow); return;
    }
    const { data, error: err } = await supabase
      .from('physician_tracker').insert({ ...form, org_id: orgId }).select().single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave(data as PhysicianRow);
  }

  const sCls = "w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8843a] transition-colors";

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="px-5 py-3 border-b border-[#2e2016] shrink-0">
        <h2 className="font-bold text-white text-lg">New Physician Daily Record</h2>
        <p className="text-xs text-[#c4b49a]/50 mt-0.5">Submit at the end of each clinical day. All fields marked * are required.</p>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-5">

        {/* GENERAL */}
        <SectionBanner title="General — Submission Details" description="This form is for the physician's daily KPI submission." />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lCls}>Submitted By<span className="text-[#c8843a] ml-0.5">*</span></label>
            <input value={s('submitted_by')} onChange={e => set('submitted_by', e.target.value)} placeholder="Physician name" className={iCls} />
          </div>
          <div>
            <label className={lCls}>Date<span className="text-[#c8843a] ml-0.5">*</span></label>
            <input type="date" value={s('date')} onChange={e => set('date', e.target.value)} className={iCls} />
          </div>
        </div>
        <NInput label="Total Patients Encountered Today" field="total_patients_encountered"
          value={n('total_patients_encountered')} onChange={v => set('total_patients_encountered', v)} />

        {/* CHARTS */}
        <SectionBanner title="Chart Status" description="Chart completion directly affects cash flow. Claims cannot be submitted until charts are closed and notes are signed. These numbers tell us how quickly revenue is being captured." />
        <div className="grid grid-cols-2 gap-3">
          <NInput label="Charts Pending From Prior Days" field="charts_pending_prior_days"
            value={n('charts_pending_prior_days')} onChange={v => set('charts_pending_prior_days', v)} />
          <NInput label="Charts Greater Than 7 Days Old" field="charts_greater_than_7_days"
            value={n('charts_greater_than_7_days')} onChange={v => set('charts_greater_than_7_days', v)} />
          <NInput label="Charts Closed Same Day" field="charts_closed_same_day"
            value={n('charts_closed_same_day')} onChange={v => set('charts_closed_same_day', v)} />
          <div>
            <label className={lCls}>Time Last Chart Closed<span className="text-[#c8843a] ml-0.5">*</span><Tip field="time_last_chart_closed" /></label>
            <input type="datetime-local" value={s('time_last_chart_closed')} onChange={e => set('time_last_chart_closed', e.target.value)} className={iCls} />
          </div>
        </div>
        <CheckRow label="Notes Signed Today" field="notes_signed_today"
          checked={b('notes_signed_today')} onChange={v => set('notes_signed_today', v)}
          description="Check if all notes from today's visits were signed today." />

        {/* SCHEDULE & STAFFING */}
        <SectionBanner title="Schedule & Staffing" description="These fields help identify scheduling gaps and staffing bottlenecks that are reducing clinical productivity." />
        <div className="space-y-4">
          <CheckRow label="Did today's schedule reflect the target service mix?" field="schedule_reflected_target"
            checked={b('schedule_reflected_target')} onChange={v => set('schedule_reflected_target', v)}
            description="Check if Yes. Leave unchecked if the schedule did not reflect the target mix." />

          {!b('schedule_reflected_target') && (
            <div className="ml-7">
              <label className={lCls}>If No — Why?</label>
              <textarea value={s('schedule_notes')} onChange={e => set('schedule_notes', e.target.value)}
                rows={2} placeholder="Describe why today's schedule did not match the target…"
                className={`${iCls} resize-none`} />
            </div>
          )}

          <CheckRow label="Was there a staffing gap that reduced productivity?" field="staffing_gap"
            checked={b('staffing_gap')} onChange={v => set('staffing_gap', v)}
            description="Check if Yes. This will reveal the role and duration fields." />

          {b('staffing_gap') && (
            <div className="ml-7 grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Role Impacted</label>
                <select value={s('role_impacted')} onChange={e => set('role_impacted', e.target.value)} className={sCls}>
                  <option value="">Select role…</option>
                  {ROLE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={lCls}>Duration of Staffing Gap</label>
                <input value={s('gap_duration')} onChange={e => set('gap_duration', e.target.value)}
                  placeholder="e.g. '2 hours', 'all day'" className={iCls} />
              </div>
            </div>
          )}
        </div>

        {/* REFLECTION */}
        <SectionBanner title="Delegation & Bottlenecks" description="These reflection fields are reviewed weekly to identify patterns in where physician time is being consumed." />
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={lCls}>What consumed physician time today that could be delegated?<span className="text-[#c8843a] ml-0.5">*</span><Tip field="tasks_delegatable" /></label>
            <select value={s('tasks_delegatable')} onChange={e => set('tasks_delegatable', e.target.value)} className={sCls}>
              <option value="">Select…</option>
              {DELEGATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={lCls}>Primary Bottleneck Today<span className="text-[#c8843a] ml-0.5">*</span><Tip field="primary_bottleneck" /></label>
            <select value={s('primary_bottleneck')} onChange={e => set('primary_bottleneck', e.target.value)} className={sCls}>
              <option value="">Select…</option>
              {BOTTLENECK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* CONFIRMATION */}
        <div className="bg-[#1e2a1a] border border-[#2a4a2a] rounded-lg px-4 py-3">
          <p className="text-xs text-[#90c090]">
            ✓ All required fields must be completed before submitting. If a staffing gap or scheduling issue occurred, make sure to select the relevant details so the Practice Founder team can identify patterns and recommend solutions.
          </p>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-2">{error}</div>}
      </div>

      <div className="px-5 py-4 border-t border-[#2e2016] shrink-0 flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-[#c8843a] text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-[#d4944a] disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Record'}
        </button>
        <button onClick={onCancel} className="px-6 bg-[#2e2016] text-[#c4b49a] rounded-lg py-2.5 text-sm hover:bg-[#3a2a1a] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Column config for table view ─────────────────────────────────────────────
const COLUMNS = [
  { key: 'submitted_by',             label: 'Submitted By',               width: 140 },
  { key: 'date',                     label: 'Date',                       width: 120 },
  { key: 'total_patients_encountered', label: 'Patients',                 width: 90 },
  { key: 'charts_closed_same_day',   label: 'Charts Same Day',            width: 130 },
  { key: 'charts_pending_prior_days', label: 'Charts Pending',            width: 120 },
  { key: 'charts_greater_than_7_days', label: 'Charts >7 Days',          width: 120 },
  { key: 'time_last_chart_closed',   label: 'Last Chart Closed',          width: 160 },
  { key: 'notes_signed_today',       label: 'Notes Signed',               width: 110 },
  { key: 'schedule_reflected_target', label: 'Schedule on Target',        width: 140 },
  { key: 'schedule_notes',           label: 'Schedule Notes',             width: 200 },
  { key: 'staffing_gap',             label: 'Staffing Gap',               width: 110 },
  { key: 'role_impacted',            label: 'Role Impacted',              width: 130 },
  { key: 'gap_duration',             label: 'Gap Duration',               width: 130 },
  { key: 'tasks_delegatable',        label: 'Could Be Delegated',         width: 200 },
  { key: 'primary_bottleneck',       label: 'Primary Bottleneck',         width: 200 },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PhysicianTrackerPage() {
  const { orgId, employeeName, isLoading: authLoading } = useOrgUser();
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const [localRows, setLocalRows]     = useState<PhysicianRow[]>(DEMO_ROWS);
  const [search, setSearch]           = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [selectedRow, setSelectedRow] = useState<PhysicianRow | null>(null);
  const [page, setPage]               = useState(1);
  const rowsPerPage = 25;

  const { data: dbRows } = useQuery({
    queryKey: ['physician_tracker', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('physician_tracker').select('*')
        .eq('org_id', orgId).order('date', { ascending: false });
      return (data ?? []) as PhysicianRow[];
    },
  });

  useEffect(() => { if (dbRows && dbRows.length > 0) setLocalRows(dbRows); }, [dbRows]);

  const filtered = localRows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(r).some(v => String(v).toLowerCase().includes(q));
  });

  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  function renderCell(col: typeof COLUMNS[0], row: PhysicianRow) {
    const v = (row as Record<string, unknown>)[col.key];
    if (col.key === 'submitted_by') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a5f] text-[#60a5fa] border border-[#2a4a6f]">
        <Stethoscope className="w-3 h-3" />{String(v || '—')}
      </span>
    );
    if (col.key === 'date') return <span className="text-[#c4b49a]">{v ? new Date(String(v)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>;
    if (col.key === 'time_last_chart_closed') return <span className="text-[#c4b49a] text-xs">{v ? new Date(String(v)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>;
    if (typeof v === 'boolean') return (
      <span className={`text-xs font-semibold ${v ? 'text-green-400' : 'text-[#6b5a47]'}`}>{v ? '✓ Yes' : '✗ No'}</span>
    );
    if (col.key === 'schedule_notes' || col.key === 'tasks_delegatable' || col.key === 'primary_bottleneck' || col.key === 'role_impacted' || col.key === 'gap_duration') {
      const s = String(v || '');
      return <span className="text-[#c4b49a] text-xs">{s ? (s.length > 40 ? s.slice(0, 40) + '…' : s) : <span className="text-[#3a2a1a]">—</span>}</span>;
    }
    return <span className="text-[#c4b49a] tabular-nums">{String(v ?? '—')}</span>;
  }

  // Summary stats
  const avgChartsSameDay = filtered.length > 0
    ? (filtered.reduce((a, r) => a + r.charts_closed_same_day, 0) / filtered.length).toFixed(1)
    : '—';
  const pendingTotal = filtered.reduce((a, r) => a + r.charts_pending_prior_days, 0);
  const staffingGapCount = filtered.filter(r => r.staffing_gap).length;

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-2 shrink-0 flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6b5a47]">Financial Tracker › Daily Physician Tracker</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">Daily Physician Tracker</h1>
          <p className="text-xs text-[#c4b49a]/50 mt-0.5">Table 1C — Submit at end of each clinical day</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#c8843a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#d4944a] transition-colors">
          <Plus className="w-4 h-4" />+ New Record
        </button>
      </div>

      {/* Stats */}
      <div className="px-6 pb-3 shrink-0 grid grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: filtered.length },
          { label: 'Avg Charts Same Day', value: avgChartsSameDay },
          { label: 'Total Charts Pending', value: pendingTotal },
          { label: 'Days With Staffing Gap', value: staffingGapCount },
        ].map(s => (
          <div key={s.label} className="bg-[#1e1810] border border-[#2e2016] rounded-xl px-4 py-3">
            <div className="text-xs text-[#c4b49a]/50 uppercase tracking-wider">{s.label}</div>
            <div className="text-xl font-bold text-white mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 pb-3 shrink-0">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b5a47]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search records…"
            className="w-full pl-9 pr-8 py-2 bg-[#221710] border border-[#3a2a1a] rounded-lg text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition-colors" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-[#6b5a47] hover:text-white" /></button>}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2e2016]">
                <th className="w-8 px-2 py-2"><input type="checkbox" className="w-3.5 h-3.5 rounded border-[#3a2a1a] bg-[#1a1410]" /></th>
                {COLUMNS.map(col => (
                  <th key={col.key} style={{ minWidth: col.width }} className="px-3 py-2 text-left">
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50">
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 1} className="text-center py-12 text-[#6b5a47] text-sm">No records yet. Create the first one.</td></tr>
              ) : paginated.map(row => (
                <tr key={row.id} onClick={() => setSelectedRow(row)}
                  className="border-b border-[#2e2016]/50 hover:bg-[#221710] cursor-pointer transition-colors">
                  <td className="px-2 py-2"><input type="checkbox" className="w-3.5 h-3.5 rounded border-[#3a2a1a] bg-[#1a1410]" onClick={e => e.stopPropagation()} /></td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap text-sm">{renderCell(col, row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[#c4b49a]/50">
            <span>Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-[#c8843a] text-white' : 'bg-[#2e2016] text-[#c4b49a] hover:bg-[#3a2a1a]'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-[#6b5a47] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>
            <NewPhysicianForm
              defaultSubmittedBy={employeeName || 'Physician'}
              onSave={row => { setLocalRows(p => [row, ...p]); setShowCreate(false); }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40" onClick={() => setSelectedRow(null)}>
          <div className="w-full max-w-md h-full bg-[#1e1409] border-l border-[#3a2a1a] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white text-lg">Physician Record</h2>
              <button onClick={() => setSelectedRow(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {COLUMNS.map(col => (
                <div key={col.key} className="flex justify-between text-sm py-1.5 border-b border-[#2e2016]/50">
                  <span className="text-[#c4b49a]/60 text-xs uppercase tracking-wide shrink-0 mr-3">{col.label}</span>
                  <span className="text-white font-medium text-right">{renderCell(col, selectedRow)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}