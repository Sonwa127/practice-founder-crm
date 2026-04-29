'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import { useEmployeeNames, resolveName } from '@/lib/useEmployeeNames';
import RecordComments from '@/components/RecordComments';
import {
  Plus, Filter, Eye, EyeOff, GripVertical, ChevronDown, ChevronUp,
  X, Search, Settings2, RefreshCw, FileDown, FileUp, Pin, PinOff,
  AlignJustify, Rows3, LayoutList, Layers, SortAsc, SortDesc,
  Calendar, Trash2, Maximize2, Check, CheckSquare, Square, User, Stethoscope,
} from 'lucide-react';

type RowHeight = 'compact' | 'medium' | 'tall';
type RoleImpacted = 'MA Role' | 'Front Desk Role' | 'Billing Role' | 'Other';
type SubmitterType = 'receptionist' | 'dr_evans' | 'all';

interface DailyTrackerRow {
  id: string;
  org_id: string;
  date: string;
  submitted_by: string;
  awv: number;
  cpe: number;
  new_cpe: number;
  wwc: number;
  wwe: number;
  immigration_physical: number;
  new_patient_evaluation: number;
  follow_up_visits: number;
  six_visits: number;
  nurse_visits: number;
  ccm: number;
  telehealth_visits: number;
  wellness_evaluation: number;
  wellness_follow_up: number;
  wellness_shots: number;
  iv_therapy: number;
  pellet_insertion: number;
  joint_injection: number;
  home_mobile_visits: number;
  same_day_addons: number;
  no_shows: number;
  reschedules: number;
  non_billable_phone_calls: number;
  referrals: number;
  cash_collected: number;
  credit_card_collected: number;
  check_collected: number;
  total_collections: number;
  collection_rate: number;
  referral_completion_rate: number;
  total_patients_encountered: number;
  total_charts_completed: number;
  charts_closed_same_day: number;
  charts_pending_prior_days: number;
  charts_less_than_7_days: number;
  time_last_chart_closed: string;
  notes_signed_today: boolean;
  schedule_reflected_target: boolean;
  schedule_notes: string;
  staffing_gap: boolean;
  role_impacted: RoleImpacted | '';
  gap_duration: string;
  physician_time_delegatable: string;
  primary_bottleneck: string;
}

interface ColumnDef {
  key: keyof DailyTrackerRow;
  label: string;
  visible: boolean;
  width: number;
  pinned: boolean;
  align: 'left' | 'right' | 'center';
  group: string;
}

interface FilterRule {
  id: string;
  column: keyof DailyTrackerRow;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string;
}

interface SortRule {
  column: keyof DailyTrackerRow;
  dir: 'asc' | 'desc';
}

interface SavedView {
  id: string;
  name: string;
  columns: ColumnDef[];
  filters: FilterRule[];
  sorts: SortRule[];
  groupBy: keyof DailyTrackerRow | null;
  rowHeight: RowHeight;
}

const CALCULATED_FIELDS: (keyof DailyTrackerRow)[] = [
  'collection_rate', 'referral_completion_rate', 'total_collections',
];

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'submitted_by',              label: 'Submitted By',                          visible: true,  width: 140, pinned: true,  align: 'left',   group: 'Core' },
  { key: 'date',                      label: 'Date',                                  visible: true,  width: 120, pinned: false, align: 'left',   group: 'Core' },
  { key: 'awv',                       label: 'Annual Wellness Visit',                 visible: true,  width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'cpe',                       label: 'Comprehensive Physical Exam',           visible: true,  width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'new_cpe',                   label: 'New Comprehensive Physical Exam',       visible: true,  width: 80,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'wwc',                       label: 'Well Woman Check',                      visible: true,  width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'wwe',                       label: 'Well Woman Exam',                       visible: true,  width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'immigration_physical',      label: 'Immigration Physical',                  visible: false, width: 110, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'new_patient_evaluation',    label: 'New Patient Evaluation',                visible: true,  width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'follow_up_visits',          label: 'Follow-Up Visits',                      visible: true,  width: 90,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'six_visits',                label: 'Six Visits',                            visible: false, width: 80,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'nurse_visits',              label: 'Nurse Visits',                          visible: false, width: 100, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'ccm',                       label: 'Chronic Care Management',               visible: false, width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'telehealth_visits',         label: 'Telehealth / Telemedicine Visits',      visible: true,  width: 90,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'wellness_evaluation',       label: 'Wellness Evaluation',                   visible: false, width: 70,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'wellness_follow_up',        label: 'Wellness Follow-Up',                    visible: false, width: 100, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'wellness_shots',            label: 'Wellness Shots',                        visible: false, width: 110, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'iv_therapy',                label: 'IV Therapy',                            visible: true,  width: 90,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'pellet_insertion',          label: 'Pellet Insertion',                      visible: false, width: 90,  pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'joint_injection',           label: 'Joint Injection',                       visible: false, width: 100, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'home_mobile_visits',        label: 'Home / Mobile Visits',                  visible: false, width: 160, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'same_day_addons',           label: 'Same-Day Add-Ons',                      visible: true,  width: 130, pinned: false, align: 'right',  group: 'Visit Types' },
  { key: 'no_shows',                  label: 'No-Shows',                              visible: true,  width: 90,  pinned: false, align: 'right',  group: 'Admin' },
  { key: 'reschedules',               label: 'Reschedules',                           visible: true,  width: 110, pinned: false, align: 'right',  group: 'Admin' },
  { key: 'non_billable_phone_calls',  label: 'Non-Billable Phone Calls',              visible: false, width: 140, pinned: false, align: 'right',  group: 'Admin' },
  { key: 'referrals',                 label: 'Referrals',                             visible: true,  width: 90,  pinned: false, align: 'right',  group: 'Admin' },
  { key: 'cash_collected',            label: 'Cash Collected',                        visible: true,  width: 100, pinned: false, align: 'right',  group: 'Collections' },
  { key: 'credit_card_collected',     label: 'Credit Card Collected',                 visible: true,  width: 110, pinned: false, align: 'right',  group: 'Collections' },
  { key: 'check_collected',           label: 'Check Collected',                       visible: false, width: 90,  pinned: false, align: 'right',  group: 'Collections' },
  { key: 'total_collections',         label: 'Total Collections',                     visible: true,  width: 140, pinned: false, align: 'right',  group: 'Collections' },
  { key: 'collection_rate',           label: 'Collection Rate',                       visible: true,  width: 130, pinned: false, align: 'right',  group: 'Collections' },
  { key: 'referral_completion_rate',  label: 'Referral Completion Rate',              visible: true,  width: 120, pinned: false, align: 'right',  group: 'Collections' },
  { key: 'total_patients_encountered',label: 'Total Patients Encountered',            visible: true,  width: 110, pinned: false, align: 'right',  group: 'Dr. Evans KPIs' },
  { key: 'total_charts_completed',    label: 'Total Charts Completed',                visible: true,  width: 100, pinned: false, align: 'right',  group: 'Dr. Evans KPIs' },
  { key: 'charts_closed_same_day',    label: 'Charts Closed Same Day',                visible: true,  width: 130, pinned: false, align: 'right',  group: 'Dr. Evans KPIs' },
  { key: 'charts_pending_prior_days', label: 'Charts Pending from Prior Days',        visible: true,  width: 120, pinned: false, align: 'right',  group: 'Dr. Evans KPIs' },
  { key: 'charts_less_than_7_days',   label: 'Charts Less Than 7 Days Old',           visible: false, width: 120, pinned: false, align: 'right',  group: 'Dr. Evans KPIs' },
  { key: 'time_last_chart_closed',    label: 'Time Last Chart Closed',                visible: true,  width: 140, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
  { key: 'notes_signed_today',        label: 'Notes Signed Today?',                   visible: true,  width: 120, pinned: false, align: 'center', group: 'Dr. Evans KPIs' },
  { key: 'schedule_reflected_target', label: 'Schedule Reflected Target Mix?',        visible: true,  width: 150, pinned: false, align: 'center', group: 'Dr. Evans KPIs' },
  { key: 'schedule_notes',            label: 'Schedule Notes',                        visible: false, width: 180, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
  { key: 'staffing_gap',              label: 'Staffing Gap Today?',                   visible: true,  width: 120, pinned: false, align: 'center', group: 'Dr. Evans KPIs' },
  { key: 'role_impacted',             label: 'Role Impacted',                         visible: false, width: 130, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
  { key: 'gap_duration',              label: 'Duration of Staffing Gap',              visible: false, width: 120, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
  { key: 'physician_time_delegatable',label: 'Physician Time That Could Be Delegated',visible: false, width: 160, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
  { key: 'primary_bottleneck',        label: 'Primary Bottleneck Today',              visible: false, width: 180, pinned: false, align: 'left',   group: 'Dr. Evans KPIs' },
];

const FILTER_OPS = [
  { value: 'equals',   label: '= equals'       },
  { value: 'contains', label: '∋ contains'     },
  { value: 'gt',       label: '> greater than' },
  { value: 'lt',       label: '< less than'    },
  { value: 'gte',      label: '≥ at least'     },
  { value: 'lte',      label: '≤ at most'      },
];

const DATE_PRESETS = [
  { label: 'Today',     days: 0  },
  { label: 'Last 7d',   days: 7  },
  { label: 'Last 30d',  days: 30 },
  { label: 'This month',days: -1 },
];

const ROW_H: Record<RowHeight, number> = { compact: 36, medium: 48, tall: 64 };

const DEMO: DailyTrackerRow[] = [
  {
    id: '1', org_id: 'demo', date: '2026-04-21', submitted_by: 'Receptionist',
    awv: 3, cpe: 2, new_cpe: 1, wwc: 2, wwe: 1, immigration_physical: 0,
    new_patient_evaluation: 2, follow_up_visits: 8, six_visits: 1, nurse_visits: 3,
    ccm: 2, telehealth_visits: 4, wellness_evaluation: 1, wellness_follow_up: 2,
    wellness_shots: 3, iv_therapy: 2, pellet_insertion: 0, joint_injection: 1,
    home_mobile_visits: 0, same_day_addons: 3, no_shows: 2, reschedules: 1,
    non_billable_phone_calls: 12, referrals: 4,
    cash_collected: 320, credit_card_collected: 1850, check_collected: 200,
    total_collections: 2370, collection_rate: 57.8, referral_completion_rate: 21.05,
    total_patients_encountered: 19, total_charts_completed: 17, charts_closed_same_day: 15,
    charts_pending_prior_days: 2, charts_less_than_7_days: 2,
    time_last_chart_closed: '2026-04-21T17:30', notes_signed_today: true,
    schedule_reflected_target: true, schedule_notes: '',
    staffing_gap: false, role_impacted: '', gap_duration: '',
    physician_time_delegatable: '', primary_bottleneck: 'Claim coding delays',
  },
  {
    id: '2', org_id: 'demo', date: '2026-04-20', submitted_by: 'Receptionist',
    awv: 4, cpe: 1, new_cpe: 2, wwc: 1, wwe: 2, immigration_physical: 1,
    new_patient_evaluation: 3, follow_up_visits: 7, six_visits: 0, nurse_visits: 2,
    ccm: 1, telehealth_visits: 3, wellness_evaluation: 2, wellness_follow_up: 1,
    wellness_shots: 2, iv_therapy: 1, pellet_insertion: 1, joint_injection: 0,
    home_mobile_visits: 1, same_day_addons: 2, no_shows: 1, reschedules: 2,
    non_billable_phone_calls: 9, referrals: 3,
    cash_collected: 280, credit_card_collected: 1620, check_collected: 150,
    total_collections: 2050, collection_rate: 43.16, referral_completion_rate: 14.29,
    total_patients_encountered: 21, total_charts_completed: 20, charts_closed_same_day: 19,
    charts_pending_prior_days: 1, charts_less_than_7_days: 1,
    time_last_chart_closed: '2026-04-20T16:45', notes_signed_today: true,
    schedule_reflected_target: false, schedule_notes: 'MA called out — adjusted mix',
    staffing_gap: true, role_impacted: 'MA Role', gap_duration: '4 hours',
    physician_time_delegatable: 'Prior auth calls', primary_bottleneck: 'MA shortage',
  },
  {
    id: '3', org_id: 'demo', date: '2026-04-19', submitted_by: 'Dr. Evans',
    awv: 2, cpe: 3, new_cpe: 0, wwc: 2, wwe: 1, immigration_physical: 0,
    new_patient_evaluation: 1, follow_up_visits: 9, six_visits: 2, nurse_visits: 4,
    ccm: 3, telehealth_visits: 2, wellness_evaluation: 0, wellness_follow_up: 3,
    wellness_shots: 1, iv_therapy: 3, pellet_insertion: 0, joint_injection: 2,
    home_mobile_visits: 0, same_day_addons: 1, no_shows: 3, reschedules: 0,
    non_billable_phone_calls: 7, referrals: 5,
    cash_collected: 410, credit_card_collected: 2100, check_collected: 300,
    total_collections: 2810, collection_rate: 72.05, referral_completion_rate: 26.32,
    total_patients_encountered: 19, total_charts_completed: 19, charts_closed_same_day: 18,
    charts_pending_prior_days: 0, charts_less_than_7_days: 0,
    time_last_chart_closed: '2026-04-19T16:00', notes_signed_today: true,
    schedule_reflected_target: true, schedule_notes: '',
    staffing_gap: false, role_impacted: '', gap_duration: '',
    physician_time_delegatable: '', primary_bottleneck: '',
  },
];

const fmtUSD   = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDate  = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtPct   = (n: number) => `${Number(n).toFixed(1)}%`;
const pctColor = (p: number) => p >= 60 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171';
const isUUID   = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s ?? '');

const calcRow = (r: Partial<DailyTrackerRow>): Partial<DailyTrackerRow> => {
  const cash = Number(r.cash_collected) || 0;
  const card = Number(r.credit_card_collected) || 0;
  const check = Number(r.check_collected) || 0;
  const total = cash + card + check;
  const patients = Number(r.total_patients_encountered) || 0;
  const refs = Number(r.referrals) || 0;
  return {
    total_collections: total,
    referral_completion_rate: patients > 0 ? parseFloat(((refs / patients) * 100).toFixed(2)) : 0,
  };
};

function TBtn({ icon: Icon, label, active, badge, onClick, accent }: {
  icon: React.ElementType; label?: string; active?: boolean; badge?: number;
  onClick: () => void; accent?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border font-medium transition whitespace-nowrap
        ${accent
          ? 'bg-[#c8843a] hover:bg-[#d9944a] text-white border-transparent'
          : active
            ? 'bg-[#c8843a]/15 border-[#c8843a]/60 text-[#e8a05a]'
            : 'bg-[#221710] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a]/60 hover:text-[#e8a05a]'
        }`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label && <span>{label}</span>}
      {badge != null && badge > 0 && (
        <span className="bg-[#c8843a] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span>
      )}
    </button>
  );
}

function SingleSelect({ value, options, onChange, placeholder = 'Select…' }: {
  value: string; options: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] hover:border-[#c8843a] transition text-sm text-[#c4b49a] min-w-[140px]">
        <span>{value || <span className="text-[#5a4535]">{placeholder}</span>}</span>
        <ChevronDown className="w-3 h-3 text-[#6b5a47] ml-2 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[160px] bg-[#231810] border border-[#3a2a1a] rounded-lg shadow-2xl py-1">
          {options.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2e1f0f] text-left text-sm ${value === opt ? 'text-[#c8843a]' : 'text-[#c4b49a]'}`}>
              {value === opt && <Check className="w-3 h-3 flex-shrink-0" />}
              {value !== opt && <span className="w-3" />}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyTrackerPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { orgId, employeeName, isLoading: authLoading } = useOrgUser();
  const { resolveName: resolveEmp } = useEmployeeNames(orgId);

  const [columns,         setColumns]         = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [localRows,       setLocalRows]       = useState<DailyTrackerRow[]>(DEMO);
  const [search,          setSearch]          = useState('');
  const [filters,         setFilters]         = useState<FilterRule[]>([]);
  const [sorts,           setSorts]           = useState<SortRule[]>([{ column: 'date', dir: 'desc' }]);
  const [groupBy,         setGroupBy]         = useState<keyof DailyTrackerRow | null>(null);
  const [rowHeight,       setRowHeight]       = useState<RowHeight>('medium');
  const [selectedRows,    setSelectedRows]    = useState<Set<string>>(new Set());
  const [dateRange,       setDateRange]       = useState({ from: '', to: '' });
  const [pageSize,        setPageSize]        = useState(25);
  const [page,            setPage]            = useState(1);
  const [panel,           setPanel]           = useState<'fields' | 'filter' | 'sort' | 'group' | 'views' | 'import' | null>(null);
  const [detailRow,       setDetailRow]       = useState<DailyTrackerRow | null>(null);
  const [editingCell,     setEditingCell]     = useState<{ rowId: string; col: keyof DailyTrackerRow } | null>(null);
  const [editValue,       setEditValue]       = useState('');
  const [showCreate,      setShowCreate]      = useState(false);
  const [savedViews,      setSavedViews]      = useState<SavedView[]>([]);
  const [viewName,        setViewName]        = useState('');
  const [submitterFilter, setSubmitterFilter] = useState<SubmitterType>('all');

  const dragColIdx   = useRef<number | null>(null);
  const dragOverIdx  = useRef<number | null>(null);
  const resizingCol  = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const { isLoading, refetch } = useQuery({
    queryKey: ['daily-tracker'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_tracker')
          .select('*, employees(name)')
          .eq('org_id', orgId)
          .order('date', { ascending: false });
        if (!error && data?.length) setLocalRows(data as DailyTrackerRow[]);
      } catch { /* use demo */ }
      return null;
    },
  });

  const togglePanel = (p: typeof panel) => setPanel(cur => cur === p ? null : p);

  const allRows = useCallback(() => {
    let r = [...localRows];
    if (submitterFilter === 'receptionist') {
      r = r.filter(row => { const name = (row.submitted_by ?? '').toLowerCase(); return name.includes('recept') || name.includes('front') || name.includes('staff'); });
    } else if (submitterFilter === 'dr_evans') {
      r = r.filter(row => { const name = (row.submitted_by ?? '').toLowerCase(); return name.includes('evans') || name.includes('dr') || name.includes('doctor'); });
    }
    if (search) { const q = search.toLowerCase(); r = r.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q))); }
    if (dateRange.from) r = r.filter(row => row.date >= dateRange.from);
    if (dateRange.to)   r = r.filter(row => row.date <= dateRange.to);
    for (const f of filters) {
      if (!f.value) continue;
      r = r.filter(row => {
        const val = String(row[f.column] ?? ''); const num = parseFloat(val); const fNum = parseFloat(f.value);
        switch (f.operator) {
          case 'equals':   return val.toLowerCase() === f.value.toLowerCase();
          case 'contains': return val.toLowerCase().includes(f.value.toLowerCase());
          case 'gt':  return num > fNum;  case 'lt':  return num < fNum;
          case 'gte': return num >= fNum; case 'lte': return num <= fNum;
          default: return true;
        }
      });
    }
    r.sort((a, b) => {
      for (const s of sorts) {
        const av = String(a[s.column] ?? ''); const bv = String(b[s.column] ?? '');
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        if (c !== 0) return s.dir === 'asc' ? c : -c;
      }
      return 0;
    });
    return r;
  }, [localRows, search, dateRange, filters, sorts, submitterFilter]);

  const processed  = allRows();
  const total      = processed.length;
  const paginated  = processed.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const grouped = useCallback((): Record<string, DailyTrackerRow[]> => {
    if (!groupBy) return { '': paginated };
    return paginated.reduce<Record<string, DailyTrackerRow[]>>((acc, row) => {
      const k = String(row[groupBy] ?? '—');
      if (!acc[k]) acc[k] = [];
      acc[k].push(row);
      return acc;
    }, {});
  }, [paginated, groupBy]);

  const numFields: (keyof DailyTrackerRow)[] = [
    'awv','cpe','new_cpe','wwc','wwe','immigration_physical','new_patient_evaluation',
    'follow_up_visits','six_visits','nurse_visits','ccm','telehealth_visits',
    'wellness_evaluation','wellness_follow_up','wellness_shots','iv_therapy',
    'pellet_insertion','joint_injection','home_mobile_visits','same_day_addons',
    'no_shows','reschedules','non_billable_phone_calls','referrals',
    'cash_collected','credit_card_collected','check_collected','total_collections',
    'total_patients_encountered','total_charts_completed','charts_closed_same_day',
    'charts_pending_prior_days','charts_less_than_7_days',
  ];
  const totals = numFields.reduce((acc, k) => { acc[k] = processed.reduce((s, r) => s + (Number(r[k]) || 0), 0); return acc; }, {} as Record<string, number>);
  totals['collection_rate'] = processed.length ? processed.reduce((s, r) => s + (Number(r.collection_rate) || 0), 0) / processed.length : 0;
  totals['referral_completion_rate'] = processed.length ? processed.reduce((s, r) => s + (Number(r.referral_completion_rate) || 0), 0) / processed.length : 0;

  const orderedCols = [...columns.filter(c => c.pinned && c.visible), ...columns.filter(c => !c.pinned && c.visible)];
  const pinnedCount = columns.filter(c => c.pinned && c.visible).length;
  // 40px checkbox + 40px expand button = 80px offset for first pinned column
  const pinnedLeft  = (ci: number) => 72 + orderedCols.slice(0, ci).filter(c => c.pinned).reduce((s, c) => s + c.width, 0);

  const onDragStart = (i: number) => { dragColIdx.current = i; };
  const onDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); dragOverIdx.current = i; };
  const onDrop      = () => {
    const from = dragColIdx.current; const to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    const next = [...columns]; const [m] = next.splice(from, 1); next.splice(to, 0, m);
    setColumns(next); dragColIdx.current = null; dragOverIdx.current = null;
  };

  const startResize = (e: React.MouseEvent, key: string, w: number) => {
    e.preventDefault();
    resizingCol.current = key; resizeStartX.current = e.clientX; resizeStartW.current = w;
    const move = (me: MouseEvent) => {
      if (!resizingCol.current) return;
      setColumns(p => p.map(c => c.key === resizingCol.current ? { ...c, width: Math.max(50, resizeStartW.current + me.clientX - resizeStartX.current) } : c));
    };
    const up = () => { resizingCol.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const startEdit = (rowId: string, col: keyof DailyTrackerRow, val: unknown) => {
    if (CALCULATED_FIELDS.includes(col)) return;
    if (['notes_signed_today', 'schedule_reflected_target', 'staffing_gap'].includes(col)) {
      setLocalRows(p => p.map(r => { if (r.id !== rowId) return r; const updated = { ...r, [col]: !r[col as keyof DailyTrackerRow] }; return { ...updated, ...calcRow(updated) }; }));
      return;
    }
    setEditingCell({ rowId, col }); setEditValue(String(val ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    setLocalRows(p => p.map(r => { if (r.id !== editingCell.rowId) return r; const updated = { ...r, [editingCell.col]: editValue }; return { ...updated, ...calcRow(updated) }; }));
    setEditingCell(null);
  };

  const deleteSelected = () => { setLocalRows(p => p.filter(r => !selectedRows.has(r.id))); setSelectedRows(new Set()); };
  const exportCSV = (onlySelected = false) => {
    const target = onlySelected ? localRows.filter(r => selectedRows.has(r.id)) : processed;
    const h = orderedCols.map(c => c.label).join(',');
    const b = target.map(row => orderedCols.map(c => `"${row[c.key] ?? ''}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([h + '\n' + b], { type: 'text/csv' })), download: `daily-tracker-${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target?.result as string).trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const imported = lines.slice(1).map((line, i) => { const vals = line.split(',').map(v => v.replace(/"/g, '').trim()); const obj: Record<string, unknown> = { id: `imp-${i}`, org_id: 'demo' }; headers.forEach((h, hi) => { obj[h] = vals[hi] ?? ''; }); return obj as unknown as DailyTrackerRow; });
      setLocalRows(p => [...imported, ...p]); setPanel(null);
    };
    reader.readAsText(file);
  };

  const saveView = () => { if (!viewName.trim()) return; setSavedViews(p => [...p, { id: crypto.randomUUID(), name: viewName, columns, filters, sorts, groupBy, rowHeight }]); setViewName(''); };
  const loadView = (v: SavedView) => { setColumns(v.columns); setFilters(v.filters); setSorts(v.sorts); setGroupBy(v.groupBy); setRowHeight(v.rowHeight); setPanel(null); };

  const applyPreset = (days: number) => {
    const to = new Date().toISOString().slice(0, 10);
    if (days === -1) { const d = new Date(); d.setDate(1); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
    else if (days === 0) setDateRange({ from: to, to });
    else { const d = new Date(); d.setDate(d.getDate() - days); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
  };

  const renderCell = (col: ColumnDef, row: DailyTrackerRow) => {
    if (editingCell?.rowId === row.id && editingCell?.col === col.key) {
      return (
        <div className="flex items-center gap-1">
          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-full px-1 py-0.5 bg-[#1a1410] border border-[#c8843a] rounded text-sm text-white focus:outline-none" />
          <button onClick={commitEdit} className="text-green-400 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditingCell(null)} className="text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    switch (col.key) {
      case 'submitted_by': {
        const name = isUUID(row.submitted_by) ? `Staff (${row.submitted_by.slice(0,6)}…)` : (row.submitted_by || '—');
        const isEvans = name.toLowerCase().includes('evans') || name.toLowerCase().includes('dr');
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${isEvans ? 'bg-[#1e3a5f] text-[#60a5fa] border-[#2a4a6f]' : 'bg-[#5c3d1e] text-[#e8c07a] border-[#7a5230]'}`}>
            {isEvans ? <Stethoscope className="w-3 h-3" /> : <User className="w-3 h-3" />}{name}
          </span>
        );
      }
      case 'date': return <span className="text-[#c4b49a]">{fmtDate(row.date)}</span>;
      case 'total_collections': return <span className="font-semibold text-white">{fmtUSD(Number(row.total_collections) || 0)}</span>;
      case 'cash_collected': case 'credit_card_collected': case 'check_collected':
        return <span className="text-[#c4b49a]">{fmtUSD(Number(row[col.key]) || 0)}</span>;
      case 'collection_rate':
        return <span className="font-semibold text-xs px-1.5 py-0.5 rounded" style={{ color: pctColor(Number(row.collection_rate)), backgroundColor: pctColor(Number(row.collection_rate)) + '18' }}>{fmtPct(Number(row.collection_rate))}</span>;
      case 'referral_completion_rate':
        return <span className="font-semibold text-xs px-1.5 py-0.5 rounded" style={{ color: pctColor(Number(row.referral_completion_rate)), backgroundColor: pctColor(Number(row.referral_completion_rate)) + '18' }}>{fmtPct(Number(row.referral_completion_rate))}</span>;
      case 'notes_signed_today': case 'schedule_reflected_target': case 'staffing_gap': {
        const val = row[col.key] as boolean;
        const isWarning = col.key === 'staffing_gap' && val;
        return (
          <button onClick={(e) => { e.stopPropagation(); startEdit(row.id, col.key, val); }} className="flex items-center justify-center gap-1 w-full">
            {val ? <><CheckSquare className={`w-4 h-4 ${isWarning ? 'text-red-400' : 'text-green-400'}`} /><span className={`text-xs ${isWarning ? 'text-red-400' : 'text-green-400'}`}>Yes</span></> : <><Square className="w-4 h-4 text-[#5a4535]" /><span className="text-xs text-[#5a4535]">No</span></>}
          </button>
        );
      }
      case 'role_impacted': return <span className="text-[#a08060] text-xs">{row.role_impacted || <span className="text-[#4b3a2a]">—</span>}</span>;
      case 'time_last_chart_closed': return <span className="text-[#c4b49a] text-xs">{row.time_last_chart_closed ? new Date(row.time_last_chart_closed).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>;
      case 'physician_time_delegatable': case 'primary_bottleneck': case 'schedule_notes': case 'gap_duration':
        return <span className="text-[#a08060] text-xs truncate block max-w-[160px]">{String(row[col.key] || '') || <span className="text-[#4b3a2a] italic">—</span>}</span>;
      case 'no_shows': return <span style={{ color: Number(row.no_shows) > 2 ? '#f87171' : '#c4b49a' }} className="font-medium">{row.no_shows}</span>;
      case 'charts_pending_prior_days': return <span style={{ color: Number(row.charts_pending_prior_days) > 0 ? '#fbbf24' : '#4b5563' }} className="font-medium">{row.charts_pending_prior_days}</span>;
      default: { const v = row[col.key]; if (typeof v === 'number') return <span className="text-[#c4b49a]">{v}</span>; return <span className="text-[#c4b49a]">{String(v ?? '')}</span>; }
    }
  };

  const currencyCols = new Set(['cash_collected','credit_card_collected','check_collected','total_collections']);
  const pctCols      = new Set(['collection_rate','referral_completion_rate']);
  const renderTotals = (col: ColumnDef) => {
    if (col.key === 'submitted_by') return <span className="text-[#a08060] text-xs font-semibold uppercase tracking-wider">Totals</span>;
    const v = totals[col.key as string]; if (v === undefined) return null;
    if (currencyCols.has(col.key)) return <span className="font-bold text-white text-sm">{fmtUSD(v)}</span>;
    if (pctCols.has(col.key)) return <span className="font-bold text-sm" style={{ color: pctColor(v) }}>AVG {fmtPct(v)}</span>;
    if (typeof v === 'number') return <span className="font-bold text-white text-sm">{v}</span>;
    return null;
  };

  const groups    = grouped();
  const groupKeys = Object.keys(groups);
  const hasActive = filters.length > 0 || dateRange.from || dateRange.to || !!groupBy;
  const colGroups = [...new Set(DEFAULT_COLUMNS.map(c => c.group))];

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">

      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <p className="text-xs text-[#6b5a47]">Financial Tracker › Daily Tracker</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Daily Tracker</h1>
      </div>

      {/* Submitter tabs */}
      <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-1">
        {([
          { key: 'all',          label: 'All Records',  icon: Layers },
          { key: 'receptionist', label: 'Receptionist', icon: User },
          { key: 'dr_evans',     label: 'Dr. Evans',    icon: Stethoscope },
        ] as { key: SubmitterType; label: string; icon: React.ElementType }[]).map(tab => (
          <button key={tab.key} onClick={() => { setSubmitterFilter(tab.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border font-medium transition
              ${submitterFilter === tab.key ? 'bg-[#c8843a]/15 border-[#c8843a]/60 text-[#e8a05a]' : 'bg-[#221710] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a]/60'}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* TOOLBAR */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[#2e2016] bg-[#1a1410] z-30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b5a47]" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
              className="w-full pl-8 pr-7 py-1.5 rounded-md bg-[#221710] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b5a47] hover:text-white"><X className="w-3 h-3" /></button>}
          </div>
          <div className="w-px h-6 bg-[#3a2a1a] mx-0.5" />
          <TBtn icon={Settings2} label="Fields" active={panel === 'fields'} badge={pinnedCount > 0 ? pinnedCount : undefined} onClick={() => togglePanel('fields')} />
          <TBtn icon={Filter}    label="Filter"  active={panel === 'filter'} badge={filters.length}  onClick={() => togglePanel('filter')} />
          <TBtn icon={SortAsc}   label="Sort"    active={panel === 'sort'}   badge={sorts.length > 1 ? sorts.length : undefined} onClick={() => togglePanel('sort')} />
          <TBtn icon={Layers}    label="Group"   active={panel === 'group' || !!groupBy} onClick={() => togglePanel('group')} />
          <TBtn icon={Calendar}  label="Date"    active={!!(dateRange.from || dateRange.to)} onClick={() => togglePanel('filter')} />
          <div className="flex items-center border border-[#3a2a1a] rounded-md overflow-hidden">
            {(['compact','medium','tall'] as RowHeight[]).map(h => {
              const Icon = h === 'compact' ? AlignJustify : h === 'medium' ? LayoutList : Rows3;
              return <button key={h} onClick={() => setRowHeight(h)} title={h} className={`px-2 py-1.5 transition ${rowHeight === h ? 'bg-[#c8843a]/20 text-[#e8a05a]' : 'bg-[#221710] text-[#6b5a47] hover:text-[#a08060]'}`}><Icon className="w-3.5 h-3.5" /></button>;
            })}
          </div>
          <div className="w-px h-6 bg-[#3a2a1a] mx-0.5" />
          <TBtn icon={Layers}   label="Views"  active={panel === 'views'}  onClick={() => togglePanel('views')} />
          <TBtn icon={FileUp}   label="Import" active={panel === 'import'} onClick={() => togglePanel('import')} />
          <TBtn icon={FileDown} label="Export" onClick={() => exportCSV(false)} />
          <TBtn icon={RefreshCw} onClick={() => refetch()} />
          <div className="ml-auto"><TBtn icon={Plus} label="New Record" accent onClick={() => setShowCreate(true)} /></div>
        </div>

        {hasActive && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {dateRange.from && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-xs text-blue-300">
                <Calendar className="w-3 h-3" />{dateRange.from} → {dateRange.to || 'now'}
                <button onClick={() => setDateRange({ from: '', to: '' })} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            )}
            {groupBy && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-700/40 text-xs text-purple-300">
                <Layers className="w-3 h-3" />Grouped by {String(groupBy).replace(/_/g, ' ')}
                <button onClick={() => setGroupBy(null)} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.map(f => (
              <span key={f.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c8843a]/10 border border-[#c8843a]/30 text-xs text-[#e8a05a]">
                <span className="font-medium capitalize">{String(f.column).replace(/_/g, ' ')}</span>
                <span className="text-[#a08060]">{f.operator}</span>
                <span>{f.value || '…'}</span>
                <button onClick={() => setFilters(p => p.filter(x => x.id !== f.id))} className="ml-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => { setFilters([]); setDateRange({ from:'',to:'' }); setGroupBy(null); }} className="text-xs text-[#6b5a47] hover:text-red-400 px-1 transition">Clear all</button>
          </div>
        )}

        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-md bg-[#c8843a]/10 border border-[#c8843a]/30">
            <span className="text-sm text-[#e8a05a] font-medium">{selectedRows.size} selected</span>
            <button onClick={() => exportCSV(true)} className="flex items-center gap-1 text-xs text-[#a08060] hover:text-[#e8a05a]"><FileDown className="w-3.5 h-3.5" /> Export selected</button>
            <button onClick={deleteSelected} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /> Delete selected</button>
            <button onClick={() => setSelectedRows(new Set())} className="ml-auto text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* PANEL STRIP */}
      {panel && (
        <div className="flex-shrink-0 border-b border-[#2e2016] bg-[#1e1409] px-6 py-3 z-20 max-h-80 overflow-y-auto">
          {panel === 'fields' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#e8c07a]">Fields — drag to reorder · pin to freeze · eye to show/hide</p>
                <div className="flex gap-3">
                  <button onClick={() => setColumns(DEFAULT_COLUMNS)} className="text-xs text-[#6b5a47] hover:text-[#e8a05a]">Reset</button>
                  <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                {colGroups.map(grp => (
                  <div key={grp}>
                    <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest mb-1 mt-2">{grp}</p>
                    {columns.filter(c => c.group === grp).map((col) => {
                      const gi = columns.findIndex(c => c.key === col.key);
                      return (
                        <div key={col.key} draggable onDragStart={() => onDragStart(gi)} onDragOver={e => onDragOver(e, gi)} onDrop={onDrop}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2e1f0f] cursor-grab group">
                          <GripVertical className="w-3 h-3 text-[#5a4535] group-hover:text-[#a08060] flex-shrink-0" />
                          <span className={`flex-1 text-xs ${col.visible ? 'text-[#c4b49a]' : 'text-[#5a4535] line-through'}`}>{col.label}</span>
                          {CALCULATED_FIELDS.includes(col.key) && <span className="text-[9px] text-[#6b5a47] bg-[#2a1c0f] px-1 rounded">fx</span>}
                          <button onClick={() => setColumns(p => p.map(c => c.key === col.key ? { ...c, pinned: !c.pinned } : c))} className={`transition ${col.pinned ? 'text-[#c8843a]' : 'text-[#5a4535] hover:text-[#a08060]'}`}>{col.pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}</button>
                          <button onClick={() => setColumns(p => p.map(c => c.key === col.key ? { ...c, visible: !c.visible } : c))} className={`transition ${col.visible ? 'text-[#c8843a]' : 'text-[#5a4535]'}`}>{col.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
          {panel === 'filter' && (
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#e8c07a]">Filters</p><button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button></div>
              <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                {DATE_PRESETS.map(p => (<button key={p.label} onClick={() => applyPreset(p.days)} className="px-2.5 py-1 rounded-md text-xs border bg-[#261c12] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] hover:text-[#e8a05a] transition">{p.label}</button>))}
                <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                <span className="text-[#6b5a47] text-xs">→</span>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                {(dateRange.from || dateRange.to) && <button onClick={() => setDateRange({ from:'',to:'' })} className="text-xs text-red-400 hover:text-red-300">Clear</button>}
              </div>
              <div className="space-y-1.5">
                {filters.length === 0 && <p className="text-xs text-[#6b5a47] italic">No filters yet.</p>}
                {filters.map(f => (
                  <div key={f.id} className="flex items-center gap-2 flex-wrap">
                    <select value={f.column} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, column: e.target.value as keyof DailyTrackerRow } : x))} className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">{DEFAULT_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                    <select value={f.operator} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, operator: e.target.value as FilterRule['operator'] } : x))} className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">{FILTER_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    <input value={f.value} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="value…" className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] w-32" />
                    <button onClick={() => setFilters(p => p.filter(x => x.id !== f.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFilters(p => [...p, { id: crypto.randomUUID(), column: 'date', operator: 'contains', value: '' }])} className="mt-2 flex items-center gap-1 text-xs text-[#c8843a] hover:text-[#e8a05a]"><Plus className="w-3.5 h-3.5" /> Add filter rule</button>
            </div>
          )}
          {panel === 'sort' && (
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#e8c07a]">Sort Rules</p><button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button></div>
              <div className="space-y-1.5">
                {sorts.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-[#6b5a47] w-4 text-right font-mono">{si + 1}</span>
                    <select value={s.column} onChange={e => setSorts(p => p.map((x, xi) => xi === si ? { ...x, column: e.target.value as keyof DailyTrackerRow } : x))} className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">{DEFAULT_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                    <button onClick={() => setSorts(p => p.map((x, xi) => xi === si ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x))} className="flex items-center gap-1 px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] hover:border-[#c8843a] transition">{s.dir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}{s.dir === 'asc' ? 'A → Z' : 'Z → A'}</button>
                    <button onClick={() => setSorts(p => p.filter((_, xi) => xi !== si))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSorts(p => [...p, { column: 'date', dir: 'desc' }])} className="mt-2 flex items-center gap-1 text-xs text-[#c8843a] hover:text-[#e8a05a]"><Plus className="w-3.5 h-3.5" /> Add sort rule</button>
            </div>
          )}
          {panel === 'group' && (
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#e8c07a]">Group By</p><button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button></div>
              <div className="flex gap-2 flex-wrap">
                {[{ key: null, label: 'None' }, ...DEFAULT_COLUMNS.filter(c => ['submitted_by','date','staffing_gap','notes_signed_today','schedule_reflected_target'].includes(c.key))].map(c => (
                  <button key={String(c.key)} onClick={() => setGroupBy(c.key as keyof DailyTrackerRow | null)} className={`px-3 py-1 rounded-md text-sm border transition ${groupBy === c.key ? 'bg-[#c8843a]/15 border-[#c8843a]/60 text-[#e8a05a]' : 'bg-[#261c12] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a]/60'}`}>{c.label}</button>
                ))}
              </div>
            </div>
          )}
          {panel === 'views' && (
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#e8c07a]">Saved Views</p><button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button></div>
              {savedViews.length === 0 && <p className="text-xs text-[#6b5a47] italic mb-2">No saved views yet.</p>}
              <div className="space-y-1 mb-3">{savedViews.map(v => (<div key={v.id} className="flex items-center gap-2"><button onClick={() => loadView(v)} className="flex-1 text-left px-2 py-1 rounded hover:bg-[#2e1f0f] text-sm text-[#c4b49a]">{v.name}</button><button onClick={() => setSavedViews(p => p.filter(x => x.id !== v.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-3.5 h-3.5" /></button></div>))}</div>
              <div className="flex gap-2"><input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="View name…" className="flex-1 px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a]" /><button onClick={saveView} className="px-3 py-1 rounded bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-medium transition">Save current</button></div>
            </div>
          )}
          {panel === 'import' && (
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-[#e8c07a]">Import CSV</p><button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button></div>
              <p className="text-xs text-[#a08060] mb-2">Headers must match field keys. Rows will be prepended.</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-[#3a2a1a] hover:border-[#c8843a] cursor-pointer transition w-fit"><FileUp className="w-4 h-4 text-[#a08060]" /><span className="text-sm text-[#a08060]">Choose CSV file…</span><input type="file" accept=".csv" onChange={handleImport} className="hidden" /></label>
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="border-collapse" style={{ minWidth: orderedCols.reduce((s, c) => s + c.width, 80) + 'px' }}>
          <thead className="sticky top-0 z-10 bg-[#1e1409]">
            <tr>
              {/* Checkbox column */}
              <th className="pf-sticky-checkbox w-10 px-2 border-b border-r border-[#2e2016]">
                <input type="checkbox" checked={selectedRows.size === paginated.length && paginated.length > 0}
                  onChange={() => selectedRows.size === paginated.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(paginated.map(r => r.id)))}
                  className="accent-[#c8843a] cursor-pointer" />
              </th>
              {/* ── Expand button column header ── */}
              <th className="pf-sticky-cell border-b border-r border-[#2e2016] w-8" style={{ left: 40 }} />
              {orderedCols.map((col, ci) => {
                const left = col.pinned ? pinnedLeft(ci) : undefined;
                const activeSortIdx = sorts.findIndex(s => s.column === col.key);
                return (
                  <th key={col.key} style={{ width: col.width, minWidth: col.width, ...(col.pinned ? { left } : {}) }}
                    className={`border-b border-r border-[#2e2016] px-3 py-2 text-left select-none group relative ${col.pinned ? 'pf-sticky-cell' : 'bg-[#1e1409]'}`}>
                    <div className="flex items-center gap-1">
                      {col.pinned && <Pin className="w-2.5 h-2.5 text-[#c8843a] flex-shrink-0 opacity-70" />}
                      <button onClick={() => { const ei = sorts.findIndex(s => s.column === col.key); if (ei >= 0) setSorts(p => p.map((s, i) => i === ei ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s)); else setSorts([{ column: col.key, dir: 'asc' }]); }}
                        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#a08060] hover:text-[#e8c07a] transition whitespace-nowrap">
                        {col.label}
                        {activeSortIdx >= 0 ? (sorts[activeSortIdx].dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#c8843a]" /> : <ChevronDown className="w-3 h-3 text-[#c8843a]" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30" />}
                        {activeSortIdx >= 0 && sorts.length > 1 && <span className="text-[10px] text-[#c8843a] font-bold leading-none">{activeSortIdx + 1}</span>}
                      </button>
                      {CALCULATED_FIELDS.includes(col.key) && <span className="text-[9px] text-[#6b5a47] ml-1 opacity-60">fx</span>}
                    </div>
                    <div onMouseDown={e => startResize(e, col.key, col.width)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 bg-[#c8843a]/50 hover:bg-[#c8843a] transition" />
                  </th>
                );
              })}
              <th className="bg-[#1e1409] border-b border-[#2e2016] w-8" />
            </tr>
          </thead>

          <tbody>
            {groupKeys.map(gk => (
              <React.Fragment key={gk}>
                {groupBy && (
                  <tr><td colSpan={orderedCols.length + 3} className="px-4 py-1.5 text-xs font-semibold text-[#c8843a] uppercase tracking-wider border-b border-[#2e2016] bg-[#1e1409]/80"><Layers className="w-3 h-3 inline mr-1.5 opacity-60" />{gk} <span className="text-[#6b5a47] font-normal ml-1">({groups[gk].length})</span></td></tr>
                )}
                {groups[gk].map(row => (
                  <tr key={row.id} style={{ height: ROW_H[rowHeight] }}
                    onClick={() => setDetailRow(row)}
                    className={`border-b border-[#2a1c10] transition group/row cursor-pointer
                      ${selectedRows.has(row.id) ? 'bg-[#c8843a]/10 pf-row-selected' : 'hover:bg-[#221610]'}`}>
                    {/* Checkbox — stops row click */}
                    <td className="pf-sticky-checkbox w-10 px-2 border-r border-[#2a1c10]" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(row.id)}
                        onChange={() => setSelectedRows(p => { const n = new Set(p); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n; })}
                        className="accent-[#c8843a] cursor-pointer" />
                    </td>
                    {/* ── Expand button — sticky, visible on hover ── */}
                    <td className="pf-sticky-cell w-8 border-r border-[#2a1c10]"
                      style={{ left: 40 }}
                      onClick={e => { e.stopPropagation(); setDetailRow(row); }}>
                      <button className="opacity-0 group-hover/row:opacity-100 transition flex items-center justify-center w-full h-full text-[#6b5a47] hover:text-[#c8843a]">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    {orderedCols.map((col, ci) => {
                      const left = col.pinned ? pinnedLeft(ci) : undefined;
                      return (
                        <td key={col.key}
                          style={{ width: col.width, minWidth: col.width, textAlign: col.align, ...(col.pinned ? { left } : {}) }}
                          onDoubleClick={e => { e.stopPropagation(); startEdit(row.id, col.key, row[col.key]); }}
                          className={`px-3 border-r border-[#2a1c10] overflow-hidden ${col.pinned ? 'pf-sticky-cell' : ''} ${rowHeight === 'compact' ? 'py-0' : rowHeight === 'medium' ? 'py-2' : 'py-3'}`}>
                          {renderCell(col, row)}
                        </td>
                      );
                    })}
                    <td className="w-8" />
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={orderedCols.length + 3} className="text-center py-16 text-[#6b5a47] text-sm">No records match your filters.</td></tr>
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10 bg-[#1e1409]">
            <tr className="border-t-2 border-[#3a2a1a]">
              <td className="pf-sticky-checkbox w-10 px-2 border-r border-[#2e2016]" />
              {/* ── Expand column placeholder in footer ── */}
              <td className="pf-sticky-cell w-8 border-r border-[#2e2016]" style={{ left: 40 }} />
              {orderedCols.map((col, ci) => {
                const left = col.pinned ? pinnedLeft(ci) : undefined;
                return <td key={col.key} style={{ textAlign: col.align, ...(col.pinned ? { left } : {}) }} className={`px-3 py-2 border-r border-[#2e2016] ${col.pinned ? 'pf-sticky-cell' : 'bg-[#1e1409]'}`}>{renderTotals(col)}</td>;
              })}
              <td className="bg-[#1e1409] w-8" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* BOTTOM BAR */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-[#2e2016] bg-[#1a1410] flex items-center gap-4 text-xs text-[#6b5a47] z-20 flex-wrap">
        <span>Showing <span className="text-[#a08060] font-medium">{Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)}</span> of <span className="text-[#a08060] font-medium">{total}</span> records</span>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setPage(1)} disabled={page===1} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition text-xs">«</button>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition">‹</button>
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{const pg=page<=3?i+1:Math.min(page-2+i,totalPages-4+i);if(pg<1||pg>totalPages)return null;return(<button key={pg} onClick={()=>setPage(pg)} className={`w-6 h-6 rounded text-center transition ${pg===page?'bg-[#c8843a] text-white font-bold':'text-[#a08060] hover:text-white'}`}>{pg}</button>);})}
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition">›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition text-xs">»</button>
        </div>
        <div className="flex items-center gap-1">
          <span>Rows:</span>
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}} className="bg-[#221710] border border-[#3a2a1a] text-[#a08060] rounded px-1 py-0.5 focus:outline-none focus:border-[#c8843a]">
            {[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* DETAIL PANEL */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailRow(null)} />
          <div className="relative w-full max-w-lg bg-[#1e1409] border-l border-[#3a2a1a] h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <div>
                <h2 className="font-bold text-white text-lg">Daily Tracker Detail</h2>
                <p className="text-xs text-[#6b5a47]">{fmtDate(detailRow.date)} — {detailRow.submitted_by}</p>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-5 flex-1">
              {colGroups.map(grp => (
                <div key={grp}>
                  <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest mb-2 border-b border-[#2e2016] pb-1">{grp}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_COLUMNS.filter(c => c.group === grp).map(col => (
                      <div key={col.key}>
                        <p className="text-[10px] text-[#6b5a47] mb-0.5">{col.label}</p>
                        <div className="px-2 py-1 rounded bg-[#261c12] border border-[#2e2016] text-sm">{renderCell(col, detailRow)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {orgId && (
              <RecordComments recordId={detailRow.id} tableName="daily_tracker" orgId={orgId} />
            )}
            <div className="px-5 py-3 border-t border-[#2e2016]">
              <button onClick={() => setDetailRow(null)} className="w-full py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-3xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <h2 className="font-bold text-white text-lg">New Daily Tracker Record</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <NewTrackerForm onSave={row => { setLocalRows(p => [row, ...p]); setShowCreate(false); }} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function NewTrackerForm({ onSave, onCancel }: { onSave: (row: DailyTrackerRow) => void; onCancel: () => void }) {
  const [activeTab, setActiveTab] = useState<'receptionist' | 'dr_evans'>('receptionist');
  const [form, setForm] = useState({
    submitted_by: 'Receptionist', date: new Date().toISOString().slice(0,10),
    awv:'', cpe:'', new_cpe:'', wwc:'', wwe:'', immigration_physical:'',
    new_patient_evaluation:'', follow_up_visits:'', six_visits:'', nurse_visits:'',
    ccm:'', telehealth_visits:'', wellness_evaluation:'', wellness_follow_up:'',
    wellness_shots:'', iv_therapy:'', pellet_insertion:'', joint_injection:'',
    home_mobile_visits:'', same_day_addons:'', no_shows:'', reschedules:'',
    non_billable_phone_calls:'', referrals:'',
    cash_collected:'', credit_card_collected:'', check_collected:'',
    total_patients_encountered:'', total_charts_completed:'', charts_closed_same_day:'',
    charts_pending_prior_days:'', charts_less_than_7_days:'', time_last_chart_closed:'',
    notes_signed_today: false, schedule_reflected_target: false, schedule_notes:'',
    staffing_gap: false, role_impacted: '' as RoleImpacted | '', gap_duration:'',
    physician_time_delegatable:'', primary_bottleneck:'',
  });

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const n = (k: string) => parseFloat((form as Record<string, string | boolean>)[k] as string) || 0;
  const cash = n('cash_collected'); const card = n('credit_card_collected'); const check = n('check_collected');
  const totalColl = cash + card + check;
  const patients = n('total_patients_encountered'); const refs = n('referrals');
  const refRate = patients > 0 ? parseFloat(((refs / patients) * 100).toFixed(2)) : 0;

  const handleSave = () => {
    onSave({
      id: crypto.randomUUID(), org_id: 'demo', submitted_by: form.submitted_by, date: form.date,
      awv: n('awv'), cpe: n('cpe'), new_cpe: n('new_cpe'), wwc: n('wwc'), wwe: n('wwe'),
      immigration_physical: n('immigration_physical'), new_patient_evaluation: n('new_patient_evaluation'),
      follow_up_visits: n('follow_up_visits'), six_visits: n('six_visits'), nurse_visits: n('nurse_visits'),
      ccm: n('ccm'), telehealth_visits: n('telehealth_visits'), wellness_evaluation: n('wellness_evaluation'),
      wellness_follow_up: n('wellness_follow_up'), wellness_shots: n('wellness_shots'),
      iv_therapy: n('iv_therapy'), pellet_insertion: n('pellet_insertion'),
      joint_injection: n('joint_injection'), home_mobile_visits: n('home_mobile_visits'),
      same_day_addons: n('same_day_addons'), no_shows: n('no_shows'), reschedules: n('reschedules'),
      non_billable_phone_calls: n('non_billable_phone_calls'), referrals: n('referrals'),
      cash_collected: cash, credit_card_collected: card, check_collected: check,
      total_collections: totalColl, collection_rate: 0, referral_completion_rate: refRate,
      total_patients_encountered: n('total_patients_encountered'), total_charts_completed: n('total_charts_completed'),
      charts_closed_same_day: n('charts_closed_same_day'), charts_pending_prior_days: n('charts_pending_prior_days'),
      charts_less_than_7_days: n('charts_less_than_7_days'), time_last_chart_closed: form.time_last_chart_closed,
      notes_signed_today: form.notes_signed_today, schedule_reflected_target: form.schedule_reflected_target,
      schedule_notes: form.schedule_notes, staffing_gap: form.staffing_gap,
      role_impacted: form.role_impacted, gap_duration: form.gap_duration,
      physician_time_delegatable: form.physician_time_delegatable, primary_bottleneck: form.primary_bottleneck,
    });
  };

  const iCls = "w-full px-2 py-1.5 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition";
  const lCls = "block text-[10px] text-[#6b5a47] uppercase tracking-wider mb-0.5";
  const calcCls = "w-full px-2 py-1.5 rounded bg-[#1a1410] border border-[#2e2016] text-sm text-[#6b5a47]";

  const NumField = ({ label, k }: { label: string; k: string }) => (
    <div><label className={lCls}>{label}</label><input type="number" value={(form as Record<string, string | boolean>)[k] as string} onChange={e => set(k, e.target.value)} className={iCls} placeholder="0" min="0" /></div>
  );
  const BoolField = ({ label, k }: { label: string; k: string }) => (
    <div className="flex items-center gap-2 col-span-1">
      <button onClick={() => set(k, !(form as Record<string, string | boolean>)[k])} className="flex items-center gap-2 text-sm text-[#c4b49a] hover:text-white transition">
        {(form as Record<string, string | boolean>)[k] ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4 text-[#5a4535]" />}
        <span className="text-xs text-[#a08060]">{label}</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col max-h-[80vh]">
      <div className="flex border-b border-[#2e2016] px-5">
        {([{ key: 'receptionist', label: 'Receptionist KPIs', icon: User }, { key: 'dr_evans', label: 'Dr. Evans KPIs', icon: Stethoscope }] as { key: 'receptionist' | 'dr_evans'; label: string; icon: React.ElementType }[]).map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); set('submitted_by', tab.key === 'dr_evans' ? 'Dr. Evans' : 'Receptionist'); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab.key ? 'border-[#c8843a] text-[#e8a05a]' : 'border-transparent text-[#6b5a47] hover:text-[#a08060]'}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div><label className={lCls}>Submitted By</label><input value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} className={iCls} /></div>
          <div><label className={lCls}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={iCls} /></div>
        </div>
        {activeTab === 'receptionist' && (
          <>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Visit Types</p><div className="grid grid-cols-4 gap-2">{[['Annual Wellness Visit','awv'],['Comprehensive Physical Exam','cpe'],['New Comprehensive Physical Exam','new_cpe'],['Well Woman Check','wwc'],['Well Woman Exam','wwe'],['Immigration Physical','immigration_physical'],['New Patient Evaluation','new_patient_evaluation'],['Follow-Up Visits','follow_up_visits'],['Six Visits','six_visits'],['Nurse Visits','nurse_visits'],['Chronic Care Management','ccm'],['Telehealth / Telemedicine','telehealth_visits'],['Wellness Evaluation','wellness_evaluation'],['Wellness Follow-Up','wellness_follow_up'],['Wellness Shots','wellness_shots'],['IV Therapy','iv_therapy'],['Pellet Insertion','pellet_insertion'],['Joint Injection','joint_injection'],['Home / Mobile Visits','home_mobile_visits'],['Same-Day Add-Ons','same_day_addons']].map(([label,k])=><NumField key={k} label={label} k={k} />)}</div></div>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Admin</p><div className="grid grid-cols-4 gap-2">{[['No-Shows','no_shows'],['Reschedules','reschedules'],['Non-Billable Phone Calls','non_billable_phone_calls'],['Referrals','referrals']].map(([label,k])=><NumField key={k} label={label} k={k} />)}</div></div>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Collections</p><div className="grid grid-cols-4 gap-2"><NumField label="Cash ($)" k="cash_collected" /><NumField label="Credit Card ($)" k="credit_card_collected" /><NumField label="Check ($)" k="check_collected" /><div><label className={lCls}>Total Collections</label><div className={calcCls}>${totalColl.toLocaleString()}</div></div></div></div>
          </>
        )}
        {activeTab === 'dr_evans' && (
          <>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Charts & Patients</p><div className="grid grid-cols-3 gap-2"><NumField label="Patients Seen" k="total_patients_encountered" /><NumField label="Charts Completed" k="total_charts_completed" /><NumField label="Charts Same Day" k="charts_closed_same_day" /><NumField label="Charts Pending (Prior)" k="charts_pending_prior_days" /><NumField label="Charts < 7 Days" k="charts_less_than_7_days" /><div><label className={lCls}>Time Last Chart Closed</label><input type="datetime-local" value={form.time_last_chart_closed} onChange={e => set('time_last_chart_closed', e.target.value)} className={iCls} /></div></div></div>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Status Flags</p><div className="grid grid-cols-3 gap-3"><BoolField label="Notes Signed Today?" k="notes_signed_today" /><BoolField label="Schedule On Target?" k="schedule_reflected_target" /><BoolField label="Staffing Gap?" k="staffing_gap" /></div>
              {form.staffing_gap && (<div className="grid grid-cols-2 gap-2 mt-2"><div><label className={lCls}>Role Impacted</label><SingleSelect value={form.role_impacted} options={['MA Role','Front Desk Role','Billing Role','Other']} onChange={v => set('role_impacted', v)} /></div><div><label className={lCls}>Gap Duration</label><input value={form.gap_duration} onChange={e => set('gap_duration', e.target.value)} className={iCls} placeholder="e.g. 4 hours" /></div></div>)}
              {!form.schedule_reflected_target && (<div className="mt-2"><label className={lCls}>Schedule Notes (why not on target?)</label><textarea value={form.schedule_notes} onChange={e => set('schedule_notes', e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition resize-none" /></div>)}
            </div>
            <div><p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Notes</p><div className="space-y-2">{[{ label: 'What Consumed Physician Time That Could Be Delegated?', k: 'physician_time_delegatable' },{ label: 'Primary Bottleneck Today', k: 'primary_bottleneck' }].map(({ label, k }) => (<div key={k}><label className={lCls}>{label}</label><textarea value={(form as Record<string, string | boolean>)[k] as string} onChange={e => set(k, e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition resize-none" /></div>))}</div></div>
          </>
        )}
      </div>
      <div className="flex gap-2 px-5 py-3 border-t border-[#2e2016]">
        <button onClick={handleSave} className="flex-1 py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Save Record</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] text-sm transition">Cancel</button>
      </div>
    </div>
  );
}