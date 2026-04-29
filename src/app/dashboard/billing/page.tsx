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
  Calendar, Trash2, Maximize2, Check,
} from 'lucide-react';

type DenialReason = 'Missing Info' | 'Insurance Issue' | 'Coding Issue' | 'Duplicate/Not Billable' | 'System Error';
type RowHeight = 'compact' | 'medium' | 'tall';

interface BillingRow {
  id: string;
  org_id: string;
  date: string;
  submitted_by: string;
  total_charges_submitted: number;
  total_claims_submitted: number;
  total_claims_denied: number;
  denial_rate: number;
  total_claims_paid: number;
  top_denial_reason: DenialReason[];
  claims_before_24hrs: number;
  denials_resolved: number;
  denials_still_open: number;
}

interface ColumnDef {
  key: keyof BillingRow;
  label: string;
  visible: boolean;
  width: number;
  pinned: boolean;
  align: 'left' | 'right' | 'center';
}

interface FilterRule {
  id: string;
  column: keyof BillingRow;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string;
}

interface SortRule {
  column: keyof BillingRow;
  dir: 'asc' | 'desc';
}

interface SavedView {
  id: string;
  name: string;
  columns: ColumnDef[];
  filters: FilterRule[];
  sorts: SortRule[];
  groupBy: keyof BillingRow | null;
  rowHeight: RowHeight;
}

const DENIAL_REASONS: DenialReason[] = [
  'Missing Info', 'Insurance Issue', 'Coding Issue', 'Duplicate/Not Billable', 'System Error',
];

const DEMO: BillingRow[] = [
  { id: '1', org_id: 'demo', date: '2026-04-21', submitted_by: 'Michael', total_charges_submitted: 4100, total_claims_submitted: 19, total_claims_denied: 2, denial_rate: 10.53, total_claims_paid: 16, top_denial_reason: ['Missing Info', 'Coding Issue'], claims_before_24hrs: 15, denials_resolved: 1, denials_still_open: 1 },
  { id: '2', org_id: 'demo', date: '2026-04-20', submitted_by: 'Michael', total_charges_submitted: 4750, total_claims_submitted: 21, total_claims_denied: 2, denial_rate: 9.52,  total_claims_paid: 18, top_denial_reason: ['Insurance Issue'], claims_before_24hrs: 18, denials_resolved: 2, denials_still_open: 0 },
  { id: '3', org_id: 'demo', date: '2026-04-19', submitted_by: 'Michael', total_charges_submitted: 3900, total_claims_submitted: 17, total_claims_denied: 1, denial_rate: 5.88,  total_claims_paid: 15, top_denial_reason: ['Coding Issue'], claims_before_24hrs: 17, denials_resolved: 1, denials_still_open: 0 },
  { id: '4', org_id: 'demo', date: '2026-04-18', submitted_by: 'Michael', total_charges_submitted: 4600, total_claims_submitted: 20, total_claims_denied: 3, denial_rate: 15.0,  total_claims_paid: 16, top_denial_reason: ['Missing Info', 'System Error'], claims_before_24hrs: 14, denials_resolved: 1, denials_still_open: 2 },
  { id: '5', org_id: 'demo', date: '2026-04-17', submitted_by: 'Michael', total_charges_submitted: 5100, total_claims_submitted: 22, total_claims_denied: 4, denial_rate: 18.18, total_claims_paid: 17, top_denial_reason: ['Insurance Issue', 'Missing Info'], claims_before_24hrs: 16, denials_resolved: 2, denials_still_open: 2 },
  { id: '6', org_id: 'demo', date: '2026-04-16', submitted_by: 'Michael', total_charges_submitted: 3800, total_claims_submitted: 15, total_claims_denied: 1, denial_rate: 6.67,  total_claims_paid: 13, top_denial_reason: ['Coding Issue'], claims_before_24hrs: 13, denials_resolved: 1, denials_still_open: 0 },
  { id: '7', org_id: 'demo', date: '2026-04-15', submitted_by: 'Michael', total_charges_submitted: 4200, total_claims_submitted: 18, total_claims_denied: 2, denial_rate: 11.11, total_claims_paid: 15, top_denial_reason: ['Duplicate/Not Billable'], claims_before_24hrs: 12, denials_resolved: 0, denials_still_open: 2 },
];

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'submitted_by',            label: 'Submitted By',      visible: true,  width: 140, pinned: true,  align: 'left'  },
  { key: 'date',                    label: 'Date',              visible: true,  width: 130, pinned: false, align: 'left'  },
  { key: 'total_charges_submitted', label: 'Total Charges',     visible: true,  width: 140, pinned: false, align: 'right' },
  { key: 'total_claims_submitted',  label: 'Claims Submitted',  visible: true,  width: 140, pinned: false, align: 'right' },
  { key: 'total_claims_denied',     label: 'Claims Denied',     visible: true,  width: 130, pinned: false, align: 'right' },
  { key: 'denial_rate',             label: 'Denial Rate',       visible: true,  width: 110, pinned: false, align: 'right' },
  { key: 'total_claims_paid',       label: 'Claims Paid',       visible: true,  width: 120, pinned: false, align: 'right' },
  { key: 'top_denial_reason',       label: 'Top Denial Reason', visible: true,  width: 220, pinned: false, align: 'left'  },
  { key: 'claims_before_24hrs',     label: 'Claims < 24hrs',    visible: true,  width: 120, pinned: false, align: 'right' },
  { key: 'denials_resolved',        label: 'Denials Resolved',  visible: true,  width: 140, pinned: false, align: 'right' },
  { key: 'denials_still_open',      label: 'Denials Open',      visible: true,  width: 120, pinned: false, align: 'right' },
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
  { label: 'Today',      days: 0  },
  { label: 'Last 7d',    days: 7  },
  { label: 'Last 30d',   days: 30 },
  { label: 'This month', days: -1 },
];

const ROW_H: Record<RowHeight, number> = { compact: 36, medium: 52, tall: 68 };

const DENIAL_COLORS: Record<DenialReason, string> = {
  'Missing Info':           '#fbbf24',
  'Insurance Issue':        '#60a5fa',
  'Coding Issue':           '#f87171',
  'Duplicate/Not Billable': '#c084fc',
  'System Error':           '#fb923c',
};

const fmtUSD  = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dColor  = (r: number) => r === 0 ? '#4ade80' : r < 8 ? '#fbbf24' : '#f87171';

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
        <span className="bg-[#c8843a] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">{badge}</span>
      )}
    </button>
  );
}

function MultiSelectDropdown({ value, options, onChange, colorMap }: {
  value: string[]; options: string[]; onChange: (val: string[]) => void; colorMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const toggle = (opt: string) => { onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]); };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 flex-wrap min-h-[28px] w-full px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] hover:border-[#c8843a] transition text-left">
        {value.length === 0
          ? <span className="text-xs text-[#5a4535]">Select…</span>
          : value.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                style={{ color: colorMap?.[v] ?? '#c4b49a', backgroundColor: (colorMap?.[v] ?? '#c4b49a') + '22' }}>
                {v}
                <span onClick={e => { e.stopPropagation(); toggle(v); }} className="hover:opacity-70 cursor-pointer">×</span>
              </span>
            ))
        }
        <ChevronDown className="w-3 h-3 text-[#6b5a47] ml-auto flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-[#231810] border border-[#3a2a1a] rounded-lg shadow-2xl py-1">
          {options.map(opt => (
            <button key={opt} onClick={() => toggle(opt)} className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2e1f0f] text-left">
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition
                ${value.includes(opt) ? 'border-[#c8843a] bg-[#c8843a]' : 'border-[#5a4535]'}`}>
                {value.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="text-sm" style={{ color: colorMap?.[opt] ?? '#c4b49a' }}>{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { orgId, employeeName, isLoading: authLoading } = useOrgUser();
  const { resolveName: resolveEmp } = useEmployeeNames(orgId);

  const [columns,      setColumns]      = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [localRows,    setLocalRows]    = useState<BillingRow[]>(DEMO);
  const [search,       setSearch]       = useState('');
  const [filters,      setFilters]      = useState<FilterRule[]>([]);
  const [sorts,        setSorts]        = useState<SortRule[]>([{ column: 'date', dir: 'desc' }]);
  const [groupBy,      setGroupBy]      = useState<keyof BillingRow | null>(null);
  const [rowHeight,    setRowHeight]    = useState<RowHeight>('medium');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [dateRange,    setDateRange]    = useState({ from: '', to: '' });
  const [pageSize,     setPageSize]     = useState(25);
  const [page,         setPage]         = useState(1);
  const [panel,        setPanel]        = useState<'fields' | 'filter' | 'sort' | 'group' | 'views' | 'import' | null>(null);
  const [detailRow,    setDetailRow]    = useState<BillingRow | null>(null);
  const [editingCell,  setEditingCell]  = useState<{ rowId: string; col: keyof BillingRow } | null>(null);
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
    queryKey: ['billing'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_billing_claims')
          .select('*, employees(name)')
          .eq('org_id', orgId)
          .order('date', { ascending: false });
        if (!error && data?.length) setLocalRows(data as BillingRow[]);
      } catch { /* use demo */ }
      return null;
    },
  });

  const togglePanel = (p: typeof panel) => setPanel(cur => cur === p ? null : p);

  const allRows = useCallback(() => {
    let r = [...localRows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(row => Object.values(row).some(v =>
        Array.isArray(v) ? v.join(' ').toLowerCase().includes(q) : String(v).toLowerCase().includes(q)
      ));
    }
    if (dateRange.from) r = r.filter(row => row.date >= dateRange.from);
    if (dateRange.to)   r = r.filter(row => row.date <= dateRange.to);
    for (const f of filters) {
      if (!f.value) continue;
      r = r.filter(row => {
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
        const av = a[s.column] ?? ''; const bv = b[s.column] ?? '';
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

  const grouped = useCallback((): Record<string, BillingRow[]> => {
    if (!groupBy) return { '': paginated };
    return paginated.reduce<Record<string, BillingRow[]>>((acc, row) => {
      const k = Array.isArray(row[groupBy]) ? (row[groupBy] as string[]).join(', ') : String(row[groupBy] ?? '—');
      if (!acc[k]) acc[k] = [];
      acc[k].push(row);
      return acc;
    }, {});
  }, [paginated, groupBy]);

  const totals = {
    total_charges_submitted: processed.reduce((s, r) => s + r.total_charges_submitted, 0),
    total_claims_submitted:  processed.reduce((s, r) => s + r.total_claims_submitted, 0),
    total_claims_denied:     processed.reduce((s, r) => s + r.total_claims_denied, 0),
    denial_rate:             processed.length ? processed.reduce((s, r) => s + r.denial_rate, 0) / processed.length : 0,
    total_claims_paid:       processed.reduce((s, r) => s + r.total_claims_paid, 0),
    claims_before_24hrs:     processed.reduce((s, r) => s + r.claims_before_24hrs, 0),
    denials_resolved:        processed.reduce((s, r) => s + r.denials_resolved, 0),
    denials_still_open:      processed.reduce((s, r) => s + r.denials_still_open, 0),
  };

  const orderedCols = [
    ...columns.filter(c => c.pinned && c.visible),
    ...columns.filter(c => !c.pinned && c.visible),
  ];
  const pinnedCount = columns.filter(c => c.pinned && c.visible).length;
  const pinnedLeft  = (ci: number) => 40 + orderedCols.slice(0, ci).filter(c => c.pinned).reduce((s, c) => s + c.width, 0);

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
      setColumns(p => p.map(c => c.key === resizingCol.current
        ? { ...c, width: Math.max(60, resizeStartW.current + me.clientX - resizeStartX.current) } : c));
    };
    const up = () => { resizingCol.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const startEdit = (rowId: string, col: keyof BillingRow, val: unknown) => {
    if (col === 'denial_rate' || col === 'top_denial_reason') return;
    setEditingCell({ rowId, col }); setEditValue(String(val ?? ''));
  };
  const commitEdit = () => {
    if (!editingCell) return;
    setLocalRows(p => p.map(r => r.id === editingCell.rowId ? { ...r, [editingCell.col]: editValue } : r));
    setEditingCell(null);
  };

  const deleteSelected = () => { setLocalRows(p => p.filter(r => !selectedRows.has(r.id))); setSelectedRows(new Set()); };
  const exportCSV = (onlySelected = false) => {
    const target = onlySelected ? localRows.filter(r => selectedRows.has(r.id)) : processed;
    const h = orderedCols.map(c => c.label).join(',');
    const b = target.map(row => orderedCols.map(c => {
      const v = row[c.key]; return `"${Array.isArray(v) ? v.join('; ') : v ?? ''}"`;
    }).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([h + '\n' + b], { type: 'text/csv' })),
      download: `billing-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target?.result as string).trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const imported = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
        const obj: Record<string, unknown> = { id: `imp-${i}`, org_id: 'demo' };
        headers.forEach((h, hi) => { obj[h] = vals[hi] ?? ''; });
        return obj as unknown as BillingRow;
      });
      setLocalRows(p => [...imported, ...p]); setPanel(null);
    };
    reader.readAsText(file);
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    setSavedViews(p => [...p, { id: crypto.randomUUID(), name: viewName, columns, filters, sorts, groupBy, rowHeight }]);
    setViewName('');
  };
  const loadView = (v: SavedView) => {
    setColumns(v.columns); setFilters(v.filters); setSorts(v.sorts);
    setGroupBy(v.groupBy); setRowHeight(v.rowHeight); setPanel(null);
  };

  const applyPreset = (days: number) => {
    const to = new Date().toISOString().slice(0, 10);
    if (days === -1) { const d = new Date(); d.setDate(1); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
    else if (days === 0) setDateRange({ from: to, to });
    else { const d = new Date(); d.setDate(d.getDate() - days); setDateRange({ from: d.toISOString().slice(0, 10), to }); }
  };

  const renderCell = (col: ColumnDef, row: BillingRow) => {
    if (editingCell?.rowId === row.id && editingCell?.col === col.key) {
      return (
        <div className="flex items-center gap-1">
          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-full px-1 py-0.5 bg-[#1a1410] border border-[#c8843a] rounded text-sm text-white focus:outline-none" />
          <button onClick={commitEdit}                className="text-green-400 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditingCell(null)} className="text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    switch (col.key) {
      case 'submitted_by':
        return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#5c3d1e] text-[#e8c07a] border border-[#7a5230]">{resolveEmp(row.submitted_by)}</span>;
      case 'date':
        return <span className="text-[#c4b49a]">{fmtDate(row.date)}</span>;
      case 'total_charges_submitted':
        return <span className="font-semibold text-white">{fmtUSD(row.total_charges_submitted)}</span>;
      case 'total_claims_submitted':
        return <span className="text-[#c4b49a]">{row.total_claims_submitted}</span>;
      case 'total_claims_denied':
        return <span style={{ color: row.total_claims_denied > 2 ? '#f87171' : '#c4b49a' }} className="font-medium">{row.total_claims_denied}</span>;
      case 'denial_rate':
        return (
          <span className="font-semibold text-xs px-1.5 py-0.5 rounded"
            style={{ color: dColor(row.denial_rate), backgroundColor: dColor(row.denial_rate) + '18' }}>
            {row.denial_rate.toFixed(2)}%
          </span>
        );
      case 'total_claims_paid':
        return <span className="text-green-400 font-medium">{row.total_claims_paid}</span>;
      case 'top_denial_reason':
        return (
          <div className="flex flex-wrap gap-1">
            {(row.top_denial_reason ?? []).map(r => (
              <span key={r} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ color: DENIAL_COLORS[r] ?? '#c4b49a', backgroundColor: (DENIAL_COLORS[r] ?? '#c4b49a') + '22' }}>
                {r}
              </span>
            ))}
            {(row.top_denial_reason ?? []).length === 0 && <span className="text-[#5a4535] text-xs">—</span>}
          </div>
        );
      case 'claims_before_24hrs':
        return <span className="text-[#c4b49a]">{row.claims_before_24hrs}</span>;
      case 'denials_resolved':
        return <span className="text-green-400 font-medium">{row.denials_resolved}</span>;
      case 'denials_still_open':
        return <span style={{ color: row.denials_still_open > 0 ? '#fbbf24' : '#4b5563' }} className="font-medium">{row.denials_still_open}</span>;
      default:
        return <span className="text-[#c4b49a]">{String(row[col.key] ?? '')}</span>;
    }
  };

  const renderTotals = (col: ColumnDef) => {
    switch (col.key) {
      case 'submitted_by':            return <span className="text-[#a08060] text-xs font-semibold uppercase tracking-wider">Totals</span>;
      case 'total_charges_submitted': return <span className="font-bold text-white text-sm">{fmtUSD(totals.total_charges_submitted)}</span>;
      case 'total_claims_submitted':  return <span className="font-bold text-white text-sm">{totals.total_claims_submitted}</span>;
      case 'total_claims_denied':     return <span className="font-bold text-red-400 text-sm">{totals.total_claims_denied}</span>;
      case 'denial_rate':             return <span className="font-bold text-sm" style={{ color: dColor(totals.denial_rate) }}>AVG {totals.denial_rate.toFixed(1)}%</span>;
      case 'total_claims_paid':       return <span className="font-bold text-green-400 text-sm">{totals.total_claims_paid}</span>;
      case 'claims_before_24hrs':     return <span className="font-bold text-white text-sm">{totals.claims_before_24hrs}</span>;
      case 'denials_resolved':        return <span className="font-bold text-green-400 text-sm">{totals.denials_resolved}</span>;
      case 'denials_still_open':      return <span className="font-bold text-yellow-400 text-sm">{totals.denials_still_open}</span>;
      default: return null;
    }
  };

  const groups    = grouped();
  const groupKeys = Object.keys(groups);
  const hasActive = filters.length > 0 || dateRange.from || dateRange.to || !!groupBy;

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">

      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <p className="text-xs text-[#6b5a47]">Financial Tracker › Daily Billing &amp; Claims Tracker</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Daily Billing &amp; Claims</h1>
      </div>

      {/* Toolbar */}
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
            {(['compact', 'medium', 'tall'] as RowHeight[]).map(h => {
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
            <TBtn icon={Plus} label="New Record" accent onClick={() => setShowCreate(true)} />
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
            {filters.map(f => (
              <span key={f.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c8843a]/10 border border-[#c8843a]/30 text-xs text-[#e8a05a]">
                <span className="font-medium capitalize">{String(f.column).replace(/_/g, ' ')}</span>
                <span className="text-[#a08060]">{f.operator}</span>
                <span>{f.value || '…'}</span>
                <button onClick={() => setFilters(p => p.filter(x => x.id !== f.id))} className="ml-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => { setFilters([]); setDateRange({ from: '', to: '' }); setGroupBy(null); }}
              className="text-xs text-[#6b5a47] hover:text-red-400 px-1 transition">Clear all</button>
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

      {/* Panel strip */}
      {panel && (
        <div className="flex-shrink-0 border-b border-[#2e2016] bg-[#1e1409] px-6 py-3 z-20 max-h-72 overflow-y-auto">
          {panel === 'fields' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#e8c07a]">Fields — drag to reorder · pin to freeze</p>
                <div className="flex gap-3">
                  <button onClick={() => setColumns(DEFAULT_COLUMNS)} className="text-xs text-[#6b5a47] hover:text-[#e8a05a]">Reset</button>
                  <button onClick={() => setPanel(null)} className="text-[#6b5a47] hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-0.5">
                {columns.map((col, i) => (
                  <div key={col.key} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDrop={onDrop}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2e1f0f] cursor-grab group">
                    <GripVertical className="w-3.5 h-3.5 text-[#5a4535] group-hover:text-[#a08060] flex-shrink-0" />
                    <span className={`flex-1 text-sm ${col.visible ? 'text-[#c4b49a]' : 'text-[#5a4535] line-through'}`}>{col.label}</span>
                    <button onClick={() => setColumns(p => p.map(c => c.key === col.key ? { ...c, pinned: !c.pinned } : c))}
                      className={`transition ${col.pinned ? 'text-[#c8843a]' : 'text-[#5a4535] hover:text-[#a08060]'}`}>
                      {col.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setColumns(p => p.map(c => c.key === col.key ? { ...c, visible: !c.visible } : c))}
                      className={`transition ${col.visible ? 'text-[#c8843a]' : 'text-[#5a4535]'}`}>
                      {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
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
                {DATE_PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.days)}
                    className="px-2.5 py-1 rounded-md text-xs border bg-[#261c12] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] hover:text-[#e8a05a] transition">
                    {p.label}
                  </button>
                ))}
                <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
                  className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                <span className="text-[#6b5a47] text-xs">→</span>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
                  className="px-2 py-0.5 rounded bg-[#261c12] border border-[#3a2a1a] text-xs text-[#c4b49a] focus:outline-none focus:border-[#c8843a]" />
                {(dateRange.from || dateRange.to) && <button onClick={() => setDateRange({ from: '', to: '' })} className="text-xs text-red-400 hover:text-red-300">Clear</button>}
              </div>
              <div className="space-y-1.5">
                {filters.length === 0 && <p className="text-xs text-[#6b5a47] italic">No filters yet.</p>}
                {filters.map(f => (
                  <div key={f.id} className="flex items-center gap-2 flex-wrap">
                    <select value={f.column} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, column: e.target.value as keyof BillingRow } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {DEFAULT_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select value={f.operator} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, operator: e.target.value as FilterRule['operator'] } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {FILTER_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={f.value} onChange={e => setFilters(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))}
                      placeholder="value…" className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] w-32" />
                    <button onClick={() => setFilters(p => p.filter(x => x.id !== f.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFilters(p => [...p, { id: crypto.randomUUID(), column: 'date', operator: 'contains', value: '' }])}
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
                    <select value={s.column} onChange={e => setSorts(p => p.map((x, xi) => xi === si ? { ...x, column: e.target.value as keyof BillingRow } : x))}
                      className="px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] focus:outline-none focus:border-[#c8843a]">
                      {DEFAULT_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button onClick={() => setSorts(p => p.map((x, xi) => xi === si ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x))}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] hover:border-[#c8843a] transition">
                      {s.dir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                      {s.dir === 'asc' ? 'A → Z' : 'Z → A'}
                    </button>
                    <button onClick={() => setSorts(p => p.filter((_, xi) => xi !== si))} className="text-[#6b5a47] hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSorts(p => [...p, { column: 'date', dir: 'desc' }])}
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
                {[{ key: null, label: 'None' }, ...DEFAULT_COLUMNS].map(c => (
                  <button key={String(c.key)} onClick={() => setGroupBy(c.key as keyof BillingRow | null)}
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
                {savedViews.map(v => (
                  <div key={v.id} className="flex items-center gap-2">
                    <button onClick={() => loadView(v)} className="flex-1 text-left px-2 py-1 rounded hover:bg-[#2e1f0f] text-sm text-[#c4b49a]">{v.name}</button>
                    <button onClick={() => setSavedViews(p => p.filter(x => x.id !== v.id))} className="text-[#6b5a47] hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="View name…"
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

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="border-collapse" style={{ minWidth: orderedCols.reduce((s, c) => s + c.width, 60) + 'px' }}>
          <thead className="sticky top-0 z-10 bg-[#1e1409]">
            <tr>
              <th className="pf-sticky-checkbox w-10 px-2 border-b border-r border-[#2e2016]">
                <input type="checkbox"
                  checked={selectedRows.size === paginated.length && paginated.length > 0}
                  onChange={() => selectedRows.size === paginated.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(paginated.map(r => r.id)))}
                  className="accent-[#c8843a] cursor-pointer" />
              </th>
              {orderedCols.map((col, ci) => {
                const left = col.pinned ? pinnedLeft(ci) : undefined;
                const activeSortIdx = sorts.findIndex(s => s.column === col.key);
                return (
                  <th key={col.key}
                    style={{ width: col.width, minWidth: col.width, ...(col.pinned ? { left } : {}) }}
                    className={`border-b border-r border-[#2e2016] px-3 py-2 text-left select-none group relative
                      ${col.pinned ? 'pf-sticky-cell' : 'bg-[#1e1409]'}`}>
                    <div className="flex items-center gap-1">
                      {col.pinned && <Pin className="w-2.5 h-2.5 text-[#c8843a] flex-shrink-0 opacity-70" />}
                      <button onClick={() => {
                        const ei = sorts.findIndex(s => s.column === col.key);
                        if (ei >= 0) setSorts(p => p.map((s, i) => i === ei ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s));
                        else setSorts([{ column: col.key, dir: 'asc' }]);
                      }} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#a08060] hover:text-[#e8c07a] transition whitespace-nowrap">
                        {col.label}
                        {activeSortIdx >= 0
                          ? (sorts[activeSortIdx].dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#c8843a]" /> : <ChevronDown className="w-3 h-3 text-[#c8843a]" />)
                          : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30" />}
                        {activeSortIdx >= 0 && sorts.length > 1 && <span className="text-[10px] text-[#c8843a] font-bold leading-none">{activeSortIdx + 1}</span>}
                      </button>
                    </div>
                    <div onMouseDown={e => startResize(e, col.key, col.width)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 bg-[#c8843a]/50 hover:bg-[#c8843a] transition" />
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
                  <tr>
                    <td colSpan={orderedCols.length + 2} className="px-4 py-1.5 text-xs font-semibold text-[#c8843a] uppercase tracking-wider border-b border-[#2e2016] bg-[#1e1409]/80">
                      <Layers className="w-3 h-3 inline mr-1.5 opacity-60" />
                      {gk} <span className="text-[#6b5a47] font-normal ml-1">({groups[gk].length})</span>
                    </td>
                  </tr>
                )}
                {groups[gk].map(row => (
                  // ── CHANGE 1: whole row opens detail panel ────────────────
                  <tr key={row.id} style={{ height: ROW_H[rowHeight] }}
                    onClick={() => setDetailRow(row)}
                    className={`border-b border-[#2a1c10] transition group/row cursor-pointer
                      ${selectedRows.has(row.id) ? 'bg-[#c8843a]/10 pf-row-selected' : 'hover:bg-[#221610]'}`}>
                    {/* ── CHANGE 2: checkbox stops propagation ── */}
                    <td className="pf-sticky-checkbox w-10 px-2 border-r border-[#2a1c10]"
                      onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(row.id)}
                        onChange={() => setSelectedRows(p => { const n = new Set(p); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n; })}
                        className="accent-[#c8843a] cursor-pointer" />
                    </td>
                    {orderedCols.map((col, ci) => {
                      const left = col.pinned ? pinnedLeft(ci) : undefined;
                      return (
                        <td key={col.key}
                          style={{ width: col.width, minWidth: col.width, textAlign: col.align, ...(col.pinned ? { left } : {}) }}
                          onDoubleClick={e => { e.stopPropagation(); startEdit(row.id, col.key, row[col.key]); }}
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

      {/* Bottom bar */}
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

      {/* Detail panel with RecordComments */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailRow(null)} />
          <div className="relative w-full max-w-md bg-[#1e1409] border-l border-[#3a2a1a] h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <h2 className="font-bold text-white text-lg">Record Detail</h2>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4 flex-1">
              {DEFAULT_COLUMNS.map(col => (
                <div key={col.key}>
                  <p className="text-xs text-[#6b5a47] uppercase tracking-wider mb-1">{col.label}</p>
                  <div className="px-3 py-2 rounded bg-[#261c12] border border-[#3a2a1a]">
                    {col.key === 'top_denial_reason' ? (
                      <MultiSelectDropdown
                        value={detailRow.top_denial_reason}
                        options={DENIAL_REASONS}
                        colorMap={DENIAL_COLORS}
                        onChange={val => {
                          const updated: BillingRow = { ...detailRow, top_denial_reason: val as DenialReason[] };
                          setDetailRow(updated);
                          setLocalRows(p => p.map(r => r.id === updated.id ? updated : r));
                        }}
                      />
                    ) : col.key === 'denial_rate' ? (
                      <span className="font-semibold" style={{ color: dColor(detailRow.denial_rate) }}>
                        {detailRow.denial_rate.toFixed(2)}% <span className="text-[#6b5a47] text-xs font-normal">(calculated)</span>
                      </span>
                    ) : renderCell(col, detailRow)}
                  </div>
                </div>
              ))}
            </div>

            {/* ── CHANGE 3: RecordComments ── */}
            {orgId && (
              <RecordComments
                recordId={detailRow.id}
                tableName="daily_billing_claims"
                orgId={orgId}
              />
            )}

            <div className="px-5 py-3 border-t border-[#2e2016] flex gap-2">
              <button onClick={() => setDetailRow(null)}
                className="flex-1 py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2016]">
              <h2 className="font-bold text-white text-lg">New Billing Record</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <NewRecordForm
              onSave={row => { setLocalRows(p => [row, ...p]); setShowCreate(false); }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Record Form — unchanged ──────────────────────────────────────────────

function NewRecordForm({ onSave, onCancel }: { onSave: (row: BillingRow) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    submitted_by: 'Michael',
    date: new Date().toISOString().slice(0, 10),
    total_charges_submitted: '', total_claims_submitted: '', total_claims_denied: '',
    total_claims_paid: '', top_denial_reason: [] as DenialReason[],
    claims_before_24hrs: '', denials_resolved: '', denials_still_open: '',
  });

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    const denied    = parseInt(form.total_claims_denied) || 0;
    const submitted = parseInt(form.total_claims_submitted) || 0;
    onSave({
      id: crypto.randomUUID(), org_id: 'demo',
      submitted_by:            form.submitted_by,
      date:                    form.date,
      total_charges_submitted: parseFloat(form.total_charges_submitted) || 0,
      total_claims_submitted:  submitted,
      total_claims_denied:     denied,
      denial_rate:             submitted > 0 ? parseFloat(((denied / submitted) * 100).toFixed(2)) : 0,
      total_claims_paid:       parseInt(form.total_claims_paid) || 0,
      top_denial_reason:       form.top_denial_reason,
      claims_before_24hrs:     parseInt(form.claims_before_24hrs) || 0,
      denials_resolved:        parseInt(form.denials_resolved) || 0,
      denials_still_open:      parseInt(form.denials_still_open) || 0,
    });
  };

  const iCls = "w-full px-3 py-2 rounded-md bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition";
  const lCls = "block text-xs text-[#6b5a47] uppercase tracking-wider mb-1";

  return (
    <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lCls}>Submitted By</label><input value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} className={iCls} /></div>
        <div><label className={lCls}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={iCls} /></div>
        <div><label className={lCls}>Total Charges ($)</label><input type="number" value={form.total_charges_submitted} onChange={e => set('total_charges_submitted', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Claims Submitted</label><input type="number" value={form.total_claims_submitted} onChange={e => set('total_claims_submitted', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Claims Denied</label><input type="number" value={form.total_claims_denied} onChange={e => set('total_claims_denied', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Claims Paid</label><input type="number" value={form.total_claims_paid} onChange={e => set('total_claims_paid', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Claims Before 24hrs</label><input type="number" value={form.claims_before_24hrs} onChange={e => set('claims_before_24hrs', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Denials Resolved</label><input type="number" value={form.denials_resolved} onChange={e => set('denials_resolved', e.target.value)} className={iCls} placeholder="0" /></div>
        <div><label className={lCls}>Denials Still Open</label><input type="number" value={form.denials_still_open} onChange={e => set('denials_still_open', e.target.value)} className={iCls} placeholder="0" /></div>
        <div>
          <label className={lCls}>Denial Rate</label>
          <div className="px-3 py-2 rounded-md bg-[#1a1410] border border-[#2e2016] text-sm text-[#6b5a47]">
            {form.total_claims_submitted && parseInt(form.total_claims_submitted) > 0
              ? `${((parseInt(form.total_claims_denied) || 0) / parseInt(form.total_claims_submitted) * 100).toFixed(2)}%`
              : 'Auto-calculated'}
          </div>
        </div>
      </div>
      <div>
        <label className={lCls}>Top Denial Reason (select all that apply)</label>
        <MultiSelectDropdown value={form.top_denial_reason} options={DENIAL_REASONS} colorMap={DENIAL_COLORS} onChange={val => set('top_denial_reason', val)} />
      </div>
      <div className="flex gap-2 pt-2 border-t border-[#2e2016]">
        <button onClick={handleSave} className="flex-1 py-2 rounded-md bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Save Record</button>
        <button onClick={onCancel}   className="px-4 py-2 rounded-md border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] text-sm transition">Cancel</button>
      </div>
    </div>
  );
}