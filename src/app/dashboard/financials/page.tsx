'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import { useEmployeeNames, resolveName } from '@/lib/useEmployeeNames';
import RoleGuard from '@/components/RoleGuard';                          // ← NEW
import RecordComments from '@/components/RecordComments';                // ← NEW
import {
  Plus, Filter, Eye, EyeOff, GripVertical, ChevronDown, ChevronUp,
  X, Search, Settings2, RefreshCw, FileDown, FileUp, Pin, PinOff,
  AlignJustify, Rows3, LayoutList, Layers, SortAsc, SortDesc,
  Calendar, Trash2, Maximize2, Check, CheckSquare, Square,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowHeight = 'compact' | 'medium' | 'tall';

interface WeeklyRow {
  id: string;
  org_id: string;
  week_start: string;
  week_end: string;
  is_completed: boolean;
  submitted_by: string;
  bills_and_expenses_paid: number;
  other_deposits: number;
  cash_card_check_payments: number;
  insurance_payments: number;
  revenue_collected: number;
  payroll_for_week: number;
  contractor_payments: number;
  owner_pay_for_week: number;
  was_owner_paid: boolean;
  business_starting_balance: number;
  capex_starting_balance: number;
  main_income_starting_balance: number;
  opx_starting_balance: number;
  payroll_starting_balance: number;
  reserve_starting_balance: number;
  what_blocked_money: string;
  staffing_gaps: string;
  one_thing_to_fix: string;
  misc_notes: string;
  total_labour_costs: number;
  payroll_pct_of_revenue: number;
  end_of_week_balance: number;
  sow_balance: number;
}

interface ColumnDef {
  key: keyof WeeklyRow;
  label: string;
  visible: boolean;
  width: number;
  pinned: boolean;
  align: 'left' | 'right' | 'center';
  group?: string;
}

interface FilterRule {
  id: string;
  column: keyof WeeklyRow;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string;
}

interface SortRule {
  column: keyof WeeklyRow;
  dir: 'asc' | 'desc';
}

interface SavedView {
  id: string;
  name: string;
  columns: ColumnDef[];
  filters: FilterRule[];
  sorts: SortRule[];
  groupBy: keyof WeeklyRow | null;
  rowHeight: RowHeight;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO: WeeklyRow[] = [
  {
    id: '1', org_id: 'demo', submitted_by: 'Stephen',
    week_start: '2026-04-14', week_end: '2026-04-20', is_completed: false,
    bills_and_expenses_paid: 4200, other_deposits: 1500, cash_card_check_payments: 8300,
    insurance_payments: 17000, revenue_collected: 25300,
    payroll_for_week: 6500, contractor_payments: 800, owner_pay_for_week: 3500, was_owner_paid: true,
    business_starting_balance: 42000, capex_starting_balance: 8000, main_income_starting_balance: 15000,
    opx_starting_balance: 6000, payroll_starting_balance: 7000, reserve_starting_balance: 10000,
    what_blocked_money: '', staffing_gaps: '', one_thing_to_fix: 'Review billing SOP', misc_notes: '',
    total_labour_costs: 7300, payroll_pct_of_revenue: 25.69, end_of_week_balance: 55900, sow_balance: 42000,
  },
  {
    id: '2', org_id: 'demo', submitted_by: 'Stephen',
    week_start: '2026-04-07', week_end: '2026-04-13', is_completed: true,
    bills_and_expenses_paid: 3800, other_deposits: 900, cash_card_check_payments: 7500,
    insurance_payments: 14900, revenue_collected: 22400,
    payroll_for_week: 6500, contractor_payments: 800, owner_pay_for_week: 3500, was_owner_paid: true,
    business_starting_balance: 38000, capex_starting_balance: 8000, main_income_starting_balance: 13000,
    opx_starting_balance: 5500, payroll_starting_balance: 7000, reserve_starting_balance: 10000,
    what_blocked_money: 'Insurance delay on 3 claims', staffing_gaps: '', one_thing_to_fix: 'Follow up denied claims', misc_notes: '',
    total_labour_costs: 7300, payroll_pct_of_revenue: 29.02, end_of_week_balance: 49100, sow_balance: 38000,
  },
  {
    id: '3', org_id: 'demo', submitted_by: 'Stephen',
    week_start: '2026-03-31', week_end: '2026-04-06', is_completed: true,
    bills_and_expenses_paid: 3500, other_deposits: 700, cash_card_check_payments: 7800,
    insurance_payments: 16700, revenue_collected: 24500,
    payroll_for_week: 6500, contractor_payments: 800, owner_pay_for_week: 3500, was_owner_paid: true,
    business_starting_balance: 35000, capex_starting_balance: 8000, main_income_starting_balance: 12000,
    opx_starting_balance: 5000, payroll_starting_balance: 7000, reserve_starting_balance: 10000,
    what_blocked_money: '', staffing_gaps: 'Front desk short 1 day', one_thing_to_fix: 'Update scheduling template', misc_notes: '',
    total_labour_costs: 7300, payroll_pct_of_revenue: 26.53, end_of_week_balance: 47200, sow_balance: 35000,
  },
  {
    id: '4', org_id: 'demo', submitted_by: 'Stephen',
    week_start: '2026-03-24', week_end: '2026-03-30', is_completed: true,
    bills_and_expenses_paid: 4100, other_deposits: 600, cash_card_check_payments: 7200,
    insurance_payments: 15800, revenue_collected: 23000,
    payroll_for_week: 6500, contractor_payments: 800, owner_pay_for_week: 3500, was_owner_paid: true,
    business_starting_balance: 32000, capex_starting_balance: 8000, main_income_starting_balance: 11000,
    opx_starting_balance: 4500, payroll_starting_balance: 7000, reserve_starting_balance: 10000,
    what_blocked_money: '', staffing_gaps: '', one_thing_to_fix: 'Submit overdue claims', misc_notes: 'Dr Evans on leave Fri',
    total_labour_costs: 7300, payroll_pct_of_revenue: 28.26, end_of_week_balance: 44300, sow_balance: 32000,
  },
];

// ─── Columns ──────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'submitted_by',            label: 'Submitted By',          visible: true,  width: 140, pinned: true,  align: 'left',   group: 'Core' },
  { key: 'week_start',              label: 'Week Start',            visible: true,  width: 120, pinned: false, align: 'left',   group: 'Core' },
  { key: 'week_end',                label: 'Week End',              visible: true,  width: 120, pinned: false, align: 'left',   group: 'Core' },
  { key: 'is_completed',            label: 'Completed?',            visible: true,  width: 130, pinned: false, align: 'center', group: 'Core' },
  { key: 'revenue_collected',       label: 'Revenue Collected',     visible: true,  width: 150, pinned: false, align: 'right',  group: 'Revenue' },
  { key: 'cash_card_check_payments',label: 'Cash/Card/Check',       visible: true,  width: 140, pinned: false, align: 'right',  group: 'Revenue' },
  { key: 'insurance_payments',      label: 'Insurance Payments',    visible: true,  width: 150, pinned: false, align: 'right',  group: 'Revenue' },
  { key: 'other_deposits',          label: 'Other Deposits',        visible: false, width: 130, pinned: false, align: 'right',  group: 'Revenue' },
  { key: 'bills_and_expenses_paid', label: 'Bills & Expenses',      visible: true,  width: 140, pinned: false, align: 'right',  group: 'Expenses' },
  { key: 'payroll_for_week',        label: 'Payroll',               visible: true,  width: 120, pinned: false, align: 'right',  group: 'Expenses' },
  { key: 'contractor_payments',     label: 'Contractor Payments',   visible: false, width: 150, pinned: false, align: 'right',  group: 'Expenses' },
  { key: 'owner_pay_for_week',      label: 'Owner Pay',             visible: true,  width: 120, pinned: false, align: 'right',  group: 'Expenses' },
  { key: 'was_owner_paid',          label: 'Owner Paid?',           visible: true,  width: 120, pinned: false, align: 'center', group: 'Expenses' },
  { key: 'total_labour_costs',      label: 'Labour Costs',          visible: true,  width: 130, pinned: false, align: 'right',  group: 'Calculated' },
  { key: 'payroll_pct_of_revenue',  label: 'Payroll %',             visible: true,  width: 110, pinned: false, align: 'right',  group: 'Calculated' },
  { key: 'end_of_week_balance',     label: 'End of Week Balance',   visible: false, width: 160, pinned: false, align: 'right',  group: 'Calculated' },
  { key: 'sow_balance',             label: 'SOW Balance',           visible: false, width: 130, pinned: false, align: 'right',  group: 'Calculated' },
  { key: 'business_starting_balance',    label: 'Business Start Bal',    visible: false, width: 150, pinned: false, align: 'right', group: 'Balances' },
  { key: 'capex_starting_balance',       label: 'Capex Start Bal',       visible: false, width: 130, pinned: false, align: 'right', group: 'Balances' },
  { key: 'main_income_starting_balance', label: 'Main Income Start Bal', visible: false, width: 160, pinned: false, align: 'right', group: 'Balances' },
  { key: 'opx_starting_balance',         label: 'OPX Start Bal',         visible: false, width: 130, pinned: false, align: 'right', group: 'Balances' },
  { key: 'payroll_starting_balance',     label: 'Payroll Start Bal',     visible: false, width: 140, pinned: false, align: 'right', group: 'Balances' },
  { key: 'reserve_starting_balance',     label: 'Reserve Start Bal',     visible: false, width: 140, pinned: false, align: 'right', group: 'Balances' },
  { key: 'what_blocked_money', label: 'What Blocked Money?', visible: false, width: 200, pinned: false, align: 'left', group: 'Notes' },
  { key: 'staffing_gaps',      label: 'Staffing Gaps',       visible: false, width: 200, pinned: false, align: 'left', group: 'Notes' },
  { key: 'one_thing_to_fix',   label: 'One Thing to Fix',    visible: true,  width: 200, pinned: false, align: 'left', group: 'Notes' },
  { key: 'misc_notes',         label: 'MISC Notes',          visible: false, width: 200, pinned: false, align: 'left', group: 'Notes' },
];

const CALCULATED_FIELDS: (keyof WeeklyRow)[] = ['total_labour_costs', 'payroll_pct_of_revenue', 'end_of_week_balance', 'sow_balance'];

const FILTER_OPS = [
  { value: 'equals',   label: '= equals'       },
  { value: 'contains', label: '∋ contains'     },
  { value: 'gt',       label: '> greater than' },
  { value: 'lt',       label: '< less than'    },
  { value: 'gte',      label: '≥ at least'     },
  { value: 'lte',      label: '≤ at most'      },
];

const DATE_PRESETS = [
  { label: 'This week', days: 7  },
  { label: 'Last 30d',  days: 30 },
  { label: 'Last 90d',  days: 90 },
  { label: 'This month',days: -1 },
];

const ROW_H: Record<RowHeight, number> = { compact: 36, medium: 52, tall: 72 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUSD  = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const pctColor = (p: number) => p > 35 ? '#f87171' : p > 28 ? '#fbbf24' : '#4ade80';

const calcRow = (r: Partial<WeeklyRow>): Partial<WeeklyRow> => {
  const payroll    = Number(r.payroll_for_week) || 0;
  const contractor = Number(r.contractor_payments) || 0;
  const revenue    = Number(r.revenue_collected) || 0;
  const bizStart   = Number(r.business_starting_balance) || 0;
  const expenses   = Number(r.bills_and_expenses_paid) || 0;
  const labour     = payroll + contractor;
  return {
    total_labour_costs:     labour,
    payroll_pct_of_revenue: revenue > 0 ? parseFloat(((payroll / revenue) * 100).toFixed(2)) : 0,
    sow_balance:            bizStart,
    end_of_week_balance:    bizStart + revenue - expenses - labour,
  };
};

// ─── Toolbar button ───────────────────────────────────────────────────────────

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
        }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label && <span>{label}</span>}
      {badge != null && badge > 0 && (
        <span className="bg-[#c8843a] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function WeeklyFinancialsContent() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { orgId, employeeName, isLoading: authLoading } = useOrgUser();
  const { resolveName: resolveEmp } = useEmployeeNames(orgId);

  const [columns,      setColumns]      = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [localRows,    setLocalRows]    = useState<WeeklyRow[]>(DEMO);
  const [search,       setSearch]       = useState('');
  const [filters,      setFilters]      = useState<FilterRule[]>([]);
  const [sorts,        setSorts]        = useState<SortRule[]>([{ column: 'week_start', dir: 'desc' }]);
  const [groupBy,      setGroupBy]      = useState<keyof WeeklyRow | null>(null);
  const [rowHeight,    setRowHeight]    = useState<RowHeight>('medium');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [dateRange,    setDateRange]    = useState({ from: '', to: '' });
  const [pageSize,     setPageSize]     = useState(25);
  const [page,         setPage]         = useState(1);
  const [panel,        setPanel]        = useState<'fields' | 'filter' | 'sort' | 'group' | 'views' | 'import' | null>(null);
  const [detailRow,    setDetailRow]    = useState<WeeklyRow | null>(null);
  const [editingCell,  setEditingCell]  = useState<{ rowId: string; col: keyof WeeklyRow } | null>(null);
  const [editValue,    setEditValue]    = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [savedViews,   setSavedViews]   = useState<SavedView[]>([]);
  const [viewName,     setViewName]     = useState('');

  const dragColIdx   = useRef<number | null>(null);
  const dragOverIdx  = useRef<number | null>(null);
  const resizingCol  = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const { isLoading, refetch } = useQuery({
    queryKey: ['weekly-financials'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('weekly_financial_reports')
          .select('*, employees(name)')
          .eq('org_id', orgId)
          .order('week_start', { ascending: false });
        if (!error && data?.length) setLocalRows(data as WeeklyRow[]);
      } catch { /* use demo */ }
      return null;
    },
  });

  const togglePanel = (p: typeof panel) => setPanel((cur) => cur === p ? null : p);

  const allRows = useCallback(() => {
    let r = [...localRows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    }
    if (dateRange.from) r = r.filter((row) => row.week_start >= dateRange.from);
    if (dateRange.to)   r = r.filter((row) => row.week_start <= dateRange.to);
    for (const f of filters) {
      if (!f.value) continue;
      r = r.filter((row) => {
        const val = String(row[f.column] ?? '');
        const num = parseFloat(val); const fNum = parseFloat(f.value);
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
  }, [localRows, search, dateRange, filters, sorts]);

  const processed  = allRows();
  const total      = processed.length;
  const paginated  = processed.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const grouped = useCallback((): Record<string, WeeklyRow[]> => {
    if (!groupBy) return { '': paginated };
    return paginated.reduce<Record<string, WeeklyRow[]>>((acc, row) => {
      const k = String(row[groupBy] ?? '—');
      if (!acc[k]) acc[k] = [];
      acc[k].push(row);
      return acc;
    }, {});
  }, [paginated, groupBy]);

  const totals = {
    revenue_collected:        processed.reduce((s, r) => s + r.revenue_collected, 0),
    bills_and_expenses_paid:  processed.reduce((s, r) => s + r.bills_and_expenses_paid, 0),
    payroll_for_week:         processed.reduce((s, r) => s + r.payroll_for_week, 0),
    contractor_payments:      processed.reduce((s, r) => s + r.contractor_payments, 0),
    owner_pay_for_week:       processed.reduce((s, r) => s + r.owner_pay_for_week, 0),
    total_labour_costs:       processed.reduce((s, r) => s + r.total_labour_costs, 0),
    payroll_pct_of_revenue:   processed.length ? processed.reduce((s, r) => s + r.payroll_pct_of_revenue, 0) / processed.length : 0,
    cash_card_check_payments: processed.reduce((s, r) => s + r.cash_card_check_payments, 0),
    insurance_payments:       processed.reduce((s, r) => s + r.insurance_payments, 0),
    other_deposits:           processed.reduce((s, r) => s + r.other_deposits, 0),
  };

  const orderedCols = [
    ...columns.filter((c) => c.pinned && c.visible),
    ...columns.filter((c) => !c.pinned && c.visible),
  ];
  const pinnedCount = columns.filter((c) => c.pinned && c.visible).length;
  const pinnedLeft  = (ci: number) => 40 + orderedCols.slice(0, ci).filter((c) => c.pinned).reduce((s, c) => s + c.width, 0);

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
      setColumns((p) => p.map((c) => c.key === resizingCol.current
        ? { ...c, width: Math.max(60, resizeStartW.current + me.clientX - resizeStartX.current) } : c));
    };
    const up = () => { resizingCol.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const startEdit = (rowId: string, col: keyof WeeklyRow, val: unknown) => {
    if (CALCULATED_FIELDS.includes(col)) return;
    if (col === 'is_completed' || col === 'was_owner_paid') {
      setLocalRows((p) => p.map((r) => r.id === rowId ? { ...r, [col]: !r[col], ...calcRow({ ...r, [col]: !r[col] }) } : r));
      return;
    }
    setEditingCell({ rowId, col }); setEditValue(String(val ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    setLocalRows((p) => p.map((r) => {
      if (r.id !== editingCell.rowId) return r;
      const updated = { ...r, [editingCell.col]: editValue };
      return { ...updated, ...calcRow(updated) };
    }));
    setEditingCell(null);
  };

  const deleteSelected = () => { setLocalRows((p) => p.filter((r) => !selectedRows.has(r.id))); setSelectedRows(new Set()); };
  const exportCSV = (onlySelected = false) => {
    const target = onlySelected ? localRows.filter((r) => selectedRows.has(r.id)) : processed;
    const h = orderedCols.map((c) => c.label).join(',');
    const b = target.map((row) => orderedCols.map((c) => `"${row[c.key] ?? ''}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([h + '\n' + b], { type: 'text/csv' })),
      download: `weekly-financials-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
      const imported = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map((v) => v.replace(/"/g, '').trim());
        const obj: Record<string, unknown> = { id: `imp-${i}`, org_id: 'demo' };
        headers.forEach((h, hi) => { obj[h] = vals[hi] ?? ''; });
        return obj as unknown as WeeklyRow;
      });
      setLocalRows((p) => [...imported, ...p]); setPanel(null);
    };
    reader.readAsText(file);
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    setSavedViews((p) => [...p, { id: crypto.randomUUID(), name: viewName, columns, filters, sorts, groupBy, rowHeight }]);
    setViewName('');
  };
  const loadView = (v: SavedView) => {
    setColumns(v.columns); setFilters(v.filters); setSorts(v.sorts);
    setGroupBy(v.groupBy); setRowHeight(v.rowHeight); setPanel(null);
  };

  const applyPreset = (days: number) => {
    const to = new Date().toISOString().slice(0, 10);
    if (days === -1) { const d = new Date(); d.setDate(1); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
    else { const d = new Date(); d.setDate(d.getDate() - days); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
  };

  const renderCell = (col: ColumnDef, row: WeeklyRow) => {
    if (editingCell?.rowId === row.id && editingCell?.col === col.key) {
      return (
        <div className="flex items-center gap-1">
          <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-full px-1 py-0.5 bg-[#1a1410] border border-[#c8843a] rounded text-sm text-white focus:outline-none" />
          <button onClick={commitEdit}                className="text-green-400 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditingCell(null)} className="text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    switch (col.key) {
      case 'submitted_by': {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.submitted_by ?? '');
        const displayName = isUUID ? `Staff (${(row.submitted_by ?? '').slice(0, 6)}…)` : (row.submitted_by || '—');
        return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#5c3d1e] text-[#e8c07a] border border-[#7a5230]">{displayName}</span>;
      }
      case 'week_start':
      case 'week_end':
        return <span className="text-[#c4b49a]">{fmtDate(row[col.key])}</span>;
      case 'is_completed':
        return (
          <button onClick={(e) => { e.stopPropagation(); startEdit(row.id, 'is_completed', row.is_completed); }}
            className="flex items-center justify-center gap-1.5 w-full">
            {row.is_completed
              ? <><CheckSquare className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400">Done</span></>
              : <><Square className="w-4 h-4 text-[#5a4535]" /><span className="text-xs text-[#5a4535]">Pending</span></>}
          </button>
        );
      case 'was_owner_paid':
        return (
          <button onClick={(e) => { e.stopPropagation(); startEdit(row.id, 'was_owner_paid', row.was_owner_paid); }}
            className="flex items-center justify-center gap-1.5 w-full">
            {row.was_owner_paid
              ? <><CheckSquare className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400">Yes</span></>
              : <><Square className="w-4 h-4 text-[#5a4535]" /><span className="text-xs text-[#5a4535]">No</span></>}
          </button>
        );
      case 'revenue_collected':
        return <span className="font-semibold text-green-400">{fmtUSD(Number(row.revenue_collected) || 0)}</span>;
      case 'payroll_pct_of_revenue':
        return (
          <span className="font-semibold text-xs px-1.5 py-0.5 rounded"
            style={{ color: pctColor(row.payroll_pct_of_revenue), backgroundColor: pctColor(row.payroll_pct_of_revenue) + '18' }}>
            {row.payroll_pct_of_revenue.toFixed(2)}%
          </span>
        );
      case 'total_labour_costs':
        return <span className="text-[#c4b49a] font-medium">{fmtUSD(row.total_labour_costs)}</span>;
      case 'end_of_week_balance':
        return <span className={`font-semibold ${row.end_of_week_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtUSD(row.end_of_week_balance)}</span>;
      case 'what_blocked_money':
      case 'staffing_gaps':
      case 'one_thing_to_fix':
      case 'misc_notes':
        return (
          <span className="text-[#a08060] text-xs truncate block max-w-[180px]">
            {row[col.key] ? String(row[col.key]) : <span className="text-[#4b3a2a] italic">—</span>}
          </span>
        );
      default: {
        const v = row[col.key];
        if (typeof v === 'number') return <span className="text-[#c4b49a]">{fmtUSD(v)}</span>;
        return <span className="text-[#c4b49a]">{String(v ?? '')}</span>;
      }
    }
  };

  const renderTotals = (col: ColumnDef) => {
    const usdCols: (keyof WeeklyRow)[] = ['revenue_collected', 'bills_and_expenses_paid', 'payroll_for_week', 'contractor_payments', 'owner_pay_for_week', 'total_labour_costs', 'cash_card_check_payments', 'insurance_payments', 'other_deposits'];
    if (col.key === 'submitted_by') return <span className="text-[#a08060] text-xs font-semibold uppercase tracking-wider">Totals</span>;
    if (usdCols.includes(col.key)) return <span className="font-bold text-white text-sm">{fmtUSD((totals as Record<string, number>)[col.key] ?? 0)}</span>;
    if (col.key === 'payroll_pct_of_revenue') return <span className="font-bold text-sm" style={{ color: pctColor(totals.payroll_pct_of_revenue) }}>AVG {totals.payroll_pct_of_revenue.toFixed(1)}%</span>;
    return null;
  };

  const groups    = grouped();
  const groupKeys = Object.keys(groups);
  const hasActive = filters.length > 0 || dateRange.from || dateRange.to || !!groupBy;
  const colGroups = [...new Set(columns.map((c) => c.group ?? 'Other'))];

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">

      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <p className="text-xs text-[#6b5a47]">Financial Tracker › Weekly Financial Reports</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Weekly Financial Reports</h1>
      </div>

      {/* TOOLBAR — unchanged */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[#2e2016] bg-[#1a1410] z-30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b5a47]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
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
            {(['compact', 'medium', 'tall'] as RowHeight[]).map((h) => {
              const Icon = h === 'compact' ? AlignJustify : h === 'medium' ? LayoutList : Rows3;
              return (
                <button key={h} onClick={() => setRowHeight(h)} title={h}
                  className={`px-2 py-1.5 transition ${rowHeight === h ? 'bg-[#c8843a]/20 text-[#e8a05a]' : 'bg-[#221710] text-[#6b5a47] hover:text-[#a08060]'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
          <div className="w-px h-6 bg-[#3a2a1a] mx-0.5" />
          <TBtn icon={Layers}   label="Views"  active={panel === 'views'}  onClick={() => togglePanel('views')} />
          <TBtn icon={FileUp}   label="Import" active={panel === 'import'} onClick={() => togglePanel('import')} />
          <TBtn icon={FileDown} label="Export" onClick={() => exportCSV(false)} />
          <TBtn icon={RefreshCw} onClick={() => refetch()} />
          <div className="ml-auto">
            <TBtn icon={Plus} label="Add Weekly Report" accent onClick={() => setShowCreate(true)} />
          </div>
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
            {filters.map((f) => (
              <span key={f.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c8843a]/10 border border-[#c8843a]/30 text-xs text-[#e8a05a]">
                <span className="font-medium capitalize">{String(f.column).replace(/_/g, ' ')}</span>
                <span className="text-[#a08060]">{f.operator}</span>
                <span>{f.value || '…'}</span>
                <button onClick={() => setFilters((p) => p.filter((x) => x.id !== f.id))} className="ml-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => { setFilters([]); setDateRange({ from: '', to: '' }); setGroupBy(null); }}
              className="text-xs text-[#6b5a47] hover:text-red-400 px-1 transition">Clear all</button>
          </div>
        )}

        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-md bg-[#c8843a]/10 border border-[#c8843a]/30">
            <span className="text-sm text-[#e8a05a] font-medium">{selectedRows.size} selected</span>
            <button onClick={() => exportCSV(true)} className="flex items-center gap-1 text-xs text-[#a08060] hover:text-[#e8a05a]">
              <FileDown className="w-3.5 h-3.5" /> Export selected
            </button>
            <button onClick={deleteSelected} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              <Trash2 className="w-3.5 h-3.5" /> Delete selected
            </button>
            <button onClick={() => setSelectedRows(new Set())} className="ml-auto text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* PANEL STRIP — unchanged */}
      {panel && (
        <div className="flex-shrink-0 border-b border-[#2e2016] bg-[#1e1409] px-6 py-3 z-20 max-h-80 overflow-y-auto">
          {panel === 'fields' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#e8c07a]">Fields — drag to reorder · pin to freeze · click eye to show/hide</p>
                <div className="flex gap-3">
                  <button onClick={() => setColumns(DEFAULT_COLUMNS)} className="text-xs text-[#6b5a47] hover:text-[#e8a05a]">Reset</button>
                  <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                {colGroups.map((grp) => (
                  <div key={grp}>
                    <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest mb-1 mt-2">{grp}</p>
                    {columns.filter((c) => (c.group ?? 'Other') === grp).map((col) => {
                      const globalIdx = columns.findIndex((c) => c.key === col.key);
                      return (
                        <div key={col.key} draggable onDragStart={() => onDragStart(globalIdx)} onDragOver={(e) => onDragOver(e, globalIdx)} onDrop={onDrop}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2e1f0f] cursor-grab group">
                          <GripVertical className="w-3 h-3 text-[#5a4535] group-hover:text-[#a08060] flex-shrink-0" />
                          <span className={`flex-1 text-xs ${col.visible ? 'text-[#c4b49a]' : 'text-[#5a4535] line-through'}`}>{col.label}</span>
                          {CALCULATED_FIELDS.includes(col.key) && <span className="text-[9px] text-[#6b5a47] bg-[#2a1c0f] px-1 rounded">calc</span>}
                          <button onClick={() => setColumns((p) => p.map((c) => c.key === col.key ? { ...c, pinned: !c.pinned } : c))}
                            className={`transition ${col.pinned ? 'text-[#c8843a]' : 'text-[#5a4535] hover:text-[#a08060]'}`}>
                            {col.pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                          </button>
                          <button onClick={() => setColumns((p) => p.map((c) => c.key === col.key ? { ...c, visible: !c.visible } : c))}
                            className={`transition ${col.visible ? 'text-[#c8843a]' : 'text-[#5a4535]'}`}>
                            {col.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Filters</p>
                <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                {DATE_PRESETS.map((p) => (
                  <button key={p.label} onClick={() => applyPreset(p.days)}
                    className="px-2.5 py-1 rounded-md text-xs border bg-[#261c12] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] hover:text-[#e8a05a] transition">
                    {p.label}
                  </button>
                ))}
                <input type="date" value={dateRange.from} onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
                  className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                <span className="text-[#6b5a47] text-xs">→</span>
                <input type="date" value={dateRange.to} onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
                  className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                {(dateRange.from || dateRange.to) && <button onClick={() => setDateRange({ from: '', to: '' })} className="text-xs text-red-400 hover:text-red-300">Clear</button>}
              </div>
              <div className="space-y-1.5">
                {filters.length === 0 && <p className="text-xs text-[#6b5a47] italic">No filters yet.</p>}
                {filters.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 flex-wrap">
                    <select value={f.column} onChange={(e) => setFilters((p) => p.map((x) => x.id === f.id ? { ...x, column: e.target.value as keyof WeeklyRow } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {DEFAULT_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select value={f.operator} onChange={(e) => setFilters((p) => p.map((x) => x.id === f.id ? { ...x, operator: e.target.value as FilterRule['operator'] } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {FILTER_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={f.value} onChange={(e) => setFilters((p) => p.map((x) => x.id === f.id ? { ...x, value: e.target.value } : x))}
                      placeholder="value…" className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] w-32" />
                    <button onClick={() => setFilters((p) => p.filter((x) => x.id !== f.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFilters((p) => [...p, { id: crypto.randomUUID(), column: 'week_start', operator: 'contains', value: '' }])}
                className="mt-2 flex items-center gap-1 text-xs text-[#c8843a] hover:text-[#e8a05a]">
                <Plus className="w-3.5 h-3.5" /> Add filter rule
              </button>
            </div>
          )}
          {panel === 'sort' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Sort Rules</p>
                <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5">
                {sorts.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-[#6b5a47] w-4 text-right font-mono">{si + 1}</span>
                    <select value={s.column} onChange={(e) => setSorts((p) => p.map((x, xi) => xi === si ? { ...x, column: e.target.value as keyof WeeklyRow } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {DEFAULT_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button onClick={() => setSorts((p) => p.map((x, xi) => xi === si ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x))}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] hover:border-[#c8843a] transition">
                      {s.dir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                      {s.dir === 'asc' ? 'A → Z' : 'Z → A'}
                    </button>
                    <button onClick={() => setSorts((p) => p.filter((_, xi) => xi !== si))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSorts((p) => [...p, { column: 'week_start', dir: 'desc' }])}
                className="mt-2 flex items-center gap-1 text-xs text-[#c8843a] hover:text-[#e8a05a]">
                <Plus className="w-3.5 h-3.5" /> Add sort rule
              </button>
            </div>
          )}
          {panel === 'group' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Group By</p>
                <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[{ key: null, label: 'None' }, ...DEFAULT_COLUMNS.filter((c) => ['submitted_by','is_completed','was_owner_paid'].includes(c.key))].map((c) => (
                  <button key={String(c.key)} onClick={() => setGroupBy(c.key as keyof WeeklyRow | null)}
                    className={`px-3 py-1 rounded-md text-sm border transition ${groupBy === c.key ? 'bg-[#c8843a]/15 border-[#c8843a]/60 text-[#e8a05a]' : 'bg-[#261c12] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a]/60'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {panel === 'views' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Saved Views</p>
                <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              {savedViews.length === 0 && <p className="text-xs text-[#6b5a47] italic mb-2">No saved views yet.</p>}
              <div className="space-y-1 mb-3">
                {savedViews.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <button onClick={() => loadView(v)} className="flex-1 text-left px-2 py-1 rounded hover:bg-[#2e1f0f] text-sm text-[#c4b49a]">{v.name}</button>
                    <button onClick={() => setSavedViews((p) => p.filter((x) => x.id !== v.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="View name…"
                  className="flex-1 px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a]" />
                <button onClick={saveView} className="px-3 py-1 rounded bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-medium transition">Save current</button>
              </div>
            </div>
          )}
          {panel === 'import' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Import CSV</p>
                <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-[#a08060] mb-2">Headers must match field keys. Rows will be prepended.</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-[#3a2a1a] hover:border-[#c8843a] cursor-pointer transition w-fit">
                <FileUp className="w-4 h-4 text-[#a08060]" />
                <span className="text-sm text-[#a08060]">Choose CSV file…</span>
                <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
              </label>
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="border-collapse" style={{ minWidth: orderedCols.reduce((s, c) => s + c.width, 60) + 'px' }}>
          <thead className="sticky top-0 z-10 bg-[#1e1409]">
            <tr>
              <th className="pf-sticky-checkbox w-10 px-2 border-b border-r border-[#2e2016]">
                <input type="checkbox"
                  checked={selectedRows.size === paginated.length && paginated.length > 0}
                  onChange={() => selectedRows.size === paginated.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(paginated.map((r) => r.id)))}
                  className="accent-[#c8843a] cursor-pointer" />
              </th>
              {orderedCols.map((col, ci) => {
                const left = col.pinned ? pinnedLeft(ci) : undefined;
                const activeSortIdx = sorts.findIndex((s) => s.column === col.key);
                return (
                  <th key={col.key}
                    style={{ width: col.width, minWidth: col.width, ...(col.pinned ? { left } : {}) }}
                    className={`border-b border-r border-[#2e2016] px-3 py-2 text-left select-none group relative
                      ${col.pinned ? 'pf-sticky-cell' : 'bg-[#1e1409]'}`}>
                    <div className="flex items-center gap-1">
                      {col.pinned && <Pin className="w-2.5 h-2.5 text-[#c8843a] flex-shrink-0 opacity-70" />}
                      <button onClick={() => {
                        const ei = sorts.findIndex((s) => s.column === col.key);
                        if (ei >= 0) setSorts((p) => p.map((s, i) => i === ei ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s));
                        else setSorts([{ column: col.key, dir: 'asc' }]);
                      }} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#a08060] hover:text-[#e8c07a] transition whitespace-nowrap">
                        {col.label}
                        {activeSortIdx >= 0
                          ? (sorts[activeSortIdx].dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#c8843a]" /> : <ChevronDown className="w-3 h-3 text-[#c8843a]" />)
                          : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30" />}
                        {activeSortIdx >= 0 && sorts.length > 1 && <span className="text-[10px] text-[#c8843a] font-bold leading-none">{activeSortIdx + 1}</span>}
                      </button>
                      {CALCULATED_FIELDS.includes(col.key) && <span className="text-[9px] text-[#6b5a47] ml-1 opacity-60">fx</span>}
                    </div>
                    <div onMouseDown={(e) => startResize(e, col.key, col.width)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 bg-[#c8843a]/50 hover:bg-[#c8843a] transition" />
                  </th>
                );
              })}
              <th className="bg-[#1e1409] border-b border-[#2e2016] w-8" />
            </tr>
          </thead>

          <tbody>
            {groupKeys.map((gk) => (
              <React.Fragment key={gk}>
                {groupBy && (
                  <tr>
                    <td colSpan={orderedCols.length + 2} className="px-4 py-1.5 text-xs font-semibold text-[#c8843a] uppercase tracking-wider border-b border-[#2e2016] bg-[#1e1409]/80">
                      <Layers className="w-3 h-3 inline mr-1.5 opacity-60" />
                      {gk} <span className="text-[#6b5a47] font-normal ml-1">({groups[gk].length})</span>
                    </td>
                  </tr>
                )}
                {groups[gk].map((row) => (
                  // ── CHANGE 1: onClick on tr opens detail panel ──────────────
                  <tr key={row.id} style={{ height: ROW_H[rowHeight] }}
                    onClick={() => setDetailRow(row)}
                    className={`border-b border-[#2a1c10] transition group/row cursor-pointer
                      ${selectedRows.has(row.id) ? 'bg-[#c8843a]/10 pf-row-selected' : 'hover:bg-[#221610]'}`}>
                    {/* ── CHANGE 2: stopPropagation on checkbox so it doesn't open panel ── */}
                    <td className="pf-sticky-checkbox w-10 px-2 border-r border-[#2a1c10]"
                      onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(row.id)}
                        onChange={() => setSelectedRows((p) => { const n = new Set(p); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n; })}
                        className="accent-[#c8843a] cursor-pointer" />
                    </td>
                    {orderedCols.map((col, ci) => {
                      const left = col.pinned ? pinnedLeft(ci) : undefined;
                      return (
                        <td key={col.key}
                          style={{ width: col.width, minWidth: col.width, textAlign: col.align, ...(col.pinned ? { left } : {}) }}
                          onDoubleClick={(e) => { e.stopPropagation(); startEdit(row.id, col.key, row[col.key]); }}
                          className={`px-3 border-r border-[#2a1c10] overflow-hidden
                            ${col.pinned ? 'pf-sticky-cell' : ''}
                            ${rowHeight === 'compact' ? 'py-0' : rowHeight === 'medium' ? 'py-2' : 'py-3'}`}>
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
              <tr>
                <td colSpan={orderedCols.length + 2} className="text-center py-16 text-[#6b5a47] text-sm">
                  No records match your filters.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10 bg-[#1e1409]">
            <tr className="border-t-2 border-[#3a2a1a]">
              <td className="pf-sticky-checkbox w-10 px-2 border-r border-[#2e2016]" />
              {orderedCols.map((col, ci) => {
                const left = col.pinned ? pinnedLeft(ci) : undefined;
                return (
                  <td key={col.key}
                    style={{ textAlign: col.align, ...(col.pinned ? { left } : {}) }}
                    className={`px-3 py-2 border-r border-[#2e2016] ${col.pinned ? 'pf-sticky-cell' : 'bg-[#1e1409]'}`}>
                    {renderTotals(col)}
                  </td>
                );
              })}
              <td className="bg-[#1e1409] w-8" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* BOTTOM BAR — unchanged */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-[#2e2016] bg-[#1a1410] flex items-center gap-4 text-xs text-[#6b5a47] z-20 flex-wrap">
        <span>Showing <span className="text-[#a08060] font-medium">{Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)}</span> of <span className="text-[#a08060] font-medium">{total}</span> records</span>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setPage(1)} disabled={page===1} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition text-xs">«</button>
          <button onClick={() => setPage((p) => Math.max(1,p-1))} disabled={page===1} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition">‹</button>
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{const pg=page<=3?i+1:Math.min(page-2+i,totalPages-4+i);if(pg<1||pg>totalPages)return null;return(<button key={pg} onClick={()=>setPage(pg)} className={`w-6 h-6 rounded text-center transition ${pg===page?'bg-[#c8843a] text-white font-bold':'text-[#a08060] hover:text-white'}`}>{pg}</button>);})}
          <button onClick={() => setPage((p) => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition">›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="px-1.5 py-0.5 rounded border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] disabled:opacity-30 transition text-xs">»</button>
        </div>
        <div className="flex items-center gap-1">
          <span>Rows:</span>
          <select value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setPage(1);}} className="bg-[#221710] border border-[#3a2a1a] text-[#a08060] rounded px-1 py-0.5 focus:outline-none focus:border-[#c8843a]">
            {[10,25,50,100].map((n)=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* DETAIL PANEL — with RecordComments added */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailRow(null)} />
          <div className="relative w-full max-w-lg bg-[#1e1409] border-l border-[#3a2a1a] h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <div>
                <h2 className="font-bold text-white text-lg">Weekly Report Detail</h2>
                <p className="text-xs text-[#6b5a47]">{fmtDate(detailRow.week_start)} → {fmtDate(detailRow.week_end)}</p>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-5 flex-1">
              {colGroups.map((grp) => (
                <div key={grp}>
                  <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest mb-2 border-b border-[#2e2016] pb-1">{grp}</p>
                  <div className="space-y-2">
                    {DEFAULT_COLUMNS.filter((c) => (c.group ?? 'Other') === grp).map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-4">
                        <span className="text-xs text-[#6b5a47] flex-shrink-0 w-40">{col.label}</span>
                        <div className="flex-1 px-2 py-1 rounded bg-[#261c12] border border-[#2e2016] text-right">
                          {CALCULATED_FIELDS.includes(col.key) ? <span className="text-xs text-[#6b5a47] italic mr-1">fx</span> : null}
                          {renderCell(col, detailRow)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── CHANGE 3: RecordComments added here ── */}
            {orgId && (
              <RecordComments
                recordId={detailRow.id}
                tableName="weekly_financial_reports"
                orgId={orgId}
              />
            )}

            <div className="px-5 py-3 border-t border-[#2e2016]">
              <button onClick={() => setDetailRow(null)} className="w-full py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL — unchanged */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-2xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <h2 className="font-bold text-white text-lg">New Weekly Report</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <NewReportForm
              onSave={(row) => { setLocalRows((p) => [row, ...p]); setShowCreate(false); }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export with RoleGuard ────────────────────────────────────────────────────
// Only dr_evans and operations_manager can see weekly financials.

export default function WeeklyFinancialsPage() {
  return (
    <RoleGuard allow={['dr_evans', 'operations_manager', 'practice_founder', 'practice_manager']}>
      <WeeklyFinancialsContent />
    </RoleGuard>
  );
}

// ─── New Report Form — unchanged ──────────────────────────────────────────────

function NewReportForm({ onSave, onCancel }: { onSave: (row: WeeklyRow) => void; onCancel: () => void }) {
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - today.getDay() + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

  const [form, setForm] = useState({
    submitted_by: 'Stephen',
    week_start: monday.toISOString().slice(0,10),
    week_end: sunday.toISOString().slice(0,10),
    is_completed: false,
    bills_and_expenses_paid: '', other_deposits: '', cash_card_check_payments: '',
    insurance_payments: '', revenue_collected: '', payroll_for_week: '',
    contractor_payments: '', owner_pay_for_week: '', was_owner_paid: false,
    business_starting_balance: '', capex_starting_balance: '', main_income_starting_balance: '',
    opx_starting_balance: '', payroll_starting_balance: '', reserve_starting_balance: '',
    what_blocked_money: '', staffing_gaps: '', one_thing_to_fix: '', misc_notes: '',
  });

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const n = (k: string) => parseFloat((form as Record<string, string | boolean>)[k] as string) || 0;

  const payroll = n('payroll_for_week'); const contractor = n('contractor_payments');
  const revenue = n('revenue_collected'); const bizStart = n('business_starting_balance');
  const expenses = n('bills_and_expenses_paid'); const labour = payroll + contractor;
  const payrollPct = revenue > 0 ? (payroll / revenue * 100) : 0;
  const eowBal = bizStart + revenue - expenses - labour;

  const handleSave = () => {
    onSave({
      id: crypto.randomUUID(), org_id: 'demo', submitted_by: form.submitted_by,
      week_start: form.week_start, week_end: form.week_end, is_completed: form.is_completed,
      bills_and_expenses_paid: n('bills_and_expenses_paid'), other_deposits: n('other_deposits'),
      cash_card_check_payments: n('cash_card_check_payments'), insurance_payments: n('insurance_payments'),
      revenue_collected: revenue, payroll_for_week: payroll, contractor_payments: contractor,
      owner_pay_for_week: n('owner_pay_for_week'), was_owner_paid: form.was_owner_paid,
      business_starting_balance: bizStart, capex_starting_balance: n('capex_starting_balance'),
      main_income_starting_balance: n('main_income_starting_balance'), opx_starting_balance: n('opx_starting_balance'),
      payroll_starting_balance: n('payroll_starting_balance'), reserve_starting_balance: n('reserve_starting_balance'),
      what_blocked_money: form.what_blocked_money, staffing_gaps: form.staffing_gaps,
      one_thing_to_fix: form.one_thing_to_fix, misc_notes: form.misc_notes,
      total_labour_costs: labour, payroll_pct_of_revenue: parseFloat(payrollPct.toFixed(2)),
      end_of_week_balance: eowBal, sow_balance: bizStart,
    });
  };

  const iCls = "w-full px-2 py-1.5 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition";
  const lCls = "block text-[10px] text-[#6b5a47] uppercase tracking-wider mb-0.5";
  const calcCls = "w-full px-2 py-1.5 rounded bg-[#1a1410] border border-[#2e2016] text-sm text-[#6b5a47]";

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2 mt-1">{title}</p>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
  const Field = ({ label, k, type = 'text' }: { label: string; k: string; type?: string }) => (
    <div>
      <label className={lCls}>{label}</label>
      <input type={type} value={(form as Record<string,unknown>)[k] as string}
        onChange={(e) => set(k, e.target.value)} className={iCls} placeholder="0" />
    </div>
  );
  const BoolField = ({ label, k }: { label: string; k: string }) => (
    <div className="flex items-center gap-2 col-span-1">
      <button onClick={() => set(k, !(form as Record<string,unknown>)[k])}
        className="flex items-center gap-2 text-sm text-[#c4b49a] hover:text-white transition">
        {(form as Record<string,unknown>)[k] ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4 text-[#5a4535]" />}
        <span className="text-xs text-[#a08060]">{label}</span>
      </button>
    </div>
  );

  return (
    <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
      <Section title="Core">
        <Field label="Submitted By" k="submitted_by" />
        <Field label="Week Start" k="week_start" type="date" />
        <Field label="Week End" k="week_end" type="date" />
        <BoolField label="Is Completed?" k="is_completed" />
      </Section>
      <Section title="Revenue">
        <Field label="Revenue Collected ($)" k="revenue_collected" type="number" />
        <Field label="Cash/Card/Check ($)" k="cash_card_check_payments" type="number" />
        <Field label="Insurance Payments ($)" k="insurance_payments" type="number" />
        <Field label="Other Deposits ($)" k="other_deposits" type="number" />
      </Section>
      <Section title="Expenses">
        <Field label="Bills & Expenses ($)" k="bills_and_expenses_paid" type="number" />
        <Field label="Payroll ($)" k="payroll_for_week" type="number" />
        <Field label="Contractor Payments ($)" k="contractor_payments" type="number" />
        <Field label="Owner Pay ($)" k="owner_pay_for_week" type="number" />
        <BoolField label="Owner Paid?" k="was_owner_paid" />
      </Section>
      <Section title="Starting Balances">
        <Field label="Business ($)" k="business_starting_balance" type="number" />
        <Field label="Capex ($)" k="capex_starting_balance" type="number" />
        <Field label="Main Income ($)" k="main_income_starting_balance" type="number" />
        <Field label="OPX ($)" k="opx_starting_balance" type="number" />
        <Field label="Payroll ($)" k="payroll_starting_balance" type="number" />
        <Field label="Reserve ($)" k="reserve_starting_balance" type="number" />
      </Section>
      <div>
        <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Calculated (auto)</p>
        <div className="grid grid-cols-3 gap-2">
          <div><label className={lCls}>Labour Costs</label><div className={calcCls}>{fmtUSD(labour)}</div></div>
          <div><label className={lCls}>Payroll % Revenue</label><div className={calcCls}>{payrollPct.toFixed(2)}%</div></div>
          <div><label className={lCls}>End of Week Bal</label><div className={`${calcCls} ${eowBal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtUSD(eowBal)}</div></div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-2">Notes</p>
        <div className="space-y-2">
          {[
            { label: 'What Blocked Money This Week?', k: 'what_blocked_money' },
            { label: 'Staffing Gaps', k: 'staffing_gaps' },
            { label: 'One Thing to Fix Next Week', k: 'one_thing_to_fix' },
            { label: 'MISC Notes', k: 'misc_notes' },
          ].map(({ label, k }) => (
            <div key={k}>
              <label className={lCls}>{label}</label>
              <textarea value={(form as Record<string, string | boolean>)[k] as string} onChange={(e) => set(k, e.target.value)} rows={2}
                className="w-full px-2 py-1.5 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition resize-none" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-[#2e2016]">
        <button onClick={handleSave} className="flex-1 py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Save Report</button>
        <button onClick={onCancel}   className="px-4 py-2 rounded-md border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] text-sm transition">Cancel</button>
      </div>
    </div>
  );
}