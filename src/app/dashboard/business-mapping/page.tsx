'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RoleGuard from '@/components/RoleGuard'
import {
  Search, RefreshCw, Loader2, ChevronDown, ChevronUp, ChevronsUpDown,
  Layers, GitBranch, ListChecks, BookOpen, UserCheck,
  Users, Stethoscope, Star, X, ExternalLink
} from 'lucide-react'

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'core_functions', label: 'Core Functions',  icon: <Layers size={13} /> },
  { key: 'systems',        label: 'Systems',          icon: <GitBranch size={13} /> },
  { key: 'processes',      label: 'Processes',        icon: <ListChecks size={13} /> },
  { key: 'sops',           label: 'SOPs',             icon: <BookOpen size={13} /> },
  { key: 'roles',          label: 'Roles',            icon: <UserCheck size={13} /> },
  { key: 'employees',      label: 'Employees',        icon: <Users size={13} /> },
  { key: 'services',       label: 'Services',         icon: <Stethoscope size={13} /> },
  { key: 'membership',     label: 'Membership',       icon: <Star size={13} /> },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Generic table row types ──────────────────────────────────────────────────
type Row = Record<string, unknown>

// ─── Status badge colours ─────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Active':           'bg-[#0f2318] text-[#86efac]',
  'Excellent':        'bg-[#0f2318] text-[#4ade80]',
  'Started':          'bg-[#1a1a0f] text-[#facc15]',
  'To Improve':       'bg-[#1e1020] text-[#c084fc]',
  'Not Started':      'bg-[#1e1409] text-[#6b5a47]',
  'Inactive':         'bg-[#2e1010] text-[#f87171]',
  'Filled':           'bg-[#0f2318] text-[#86efac]',
  'Not Filled':       'bg-[#2e1010] text-[#f87171]',
  'Temporarily Filled':'bg-[#1a1a0f] text-[#facc15]',
  'Currently In Use': 'bg-[#0f2318] text-[#86efac]',
  'Paused':           'bg-[#1a1a0f] text-[#facc15]',
  'Not In Use':       'bg-[#1e1409] text-[#6b5a47]',
}

function StatusBadge({ val }: { val: string | null | undefined }) {
  if (!val) return <span className="text-[#6b5a47]">—</span>
  const cls = STATUS_COLORS[val] ?? 'bg-[#2e2016] text-[#c4b49a]'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{val}</span>
}

function Cell({ val }: { val: unknown }) {
  if (val === null || val === undefined || val === '') return <span className="text-[#6b5a47]">—</span>
  if (typeof val === 'boolean') return val ? <span className="text-[#86efac]">Yes</span> : <span className="text-[#f87171]">No</span>
  if (typeof val === 'number') return <span className="tabular-nums">{val}</span>
  const str = String(val)
  if (str.length > 120) return <span className="text-[#a08060]">{str.slice(0, 117)}…</span>
  return <span className="text-[#a08060]">{str}</span>
}

// ─── Column definitions per tab ───────────────────────────────────────────────
const COLUMNS: Record<TabKey, { key: string; label: string; w?: string }[]> = {
  core_functions: [
    { key: 'core_function_name', label: 'Function Name', w: 'min-w-[200px]' },
    { key: 'goal',               label: 'Goal',           w: 'min-w-[240px]' },
    { key: 'how_it_is_done',     label: 'How It\'s Done', w: 'min-w-[260px]' },
  ],
  systems: [
    { key: 'system_name',   label: 'System Name', w: 'min-w-[200px]' },
    { key: 'objective',     label: 'Objective',   w: 'min-w-[260px]' },
    { key: 'status',        label: 'Status',      w: 'min-w-[120px]' },
  ],
  processes: [
    { key: 'process_name',   label: 'Process Name',   w: 'min-w-[200px]' },
    { key: 'status',         label: 'Status',          w: 'min-w-[120px]' },
    { key: 'purpose',        label: 'Purpose',         w: 'min-w-[240px]' },
    { key: 'process_detail', label: 'Process Detail',  w: 'min-w-[260px]' },
  ],
  sops: [
    { key: 'sop_name',          label: 'SOP Name', w: 'min-w-[200px]' },
    { key: 'status',            label: 'Status',   w: 'min-w-[120px]' },
    { key: 'purpose',           label: 'Purpose',  w: 'min-w-[240px]' },
    { key: 'resources_needed',  label: 'Resources',w: 'min-w-[180px]' },
    { key: 'input',             label: 'Trigger',  w: 'min-w-[160px]' },
    { key: 'how_we_know_complete', label: 'Done When', w: 'min-w-[180px]' },
  ],
  roles: [
    { key: 'role_name',    label: 'Role Name',   w: 'min-w-[160px]' },
    { key: 'description',  label: 'Description', w: 'min-w-[260px]' },
    { key: 'status',       label: 'Status',      w: 'min-w-[140px]' },
  ],
  employees: [
    { key: 'name',         label: 'Name',         w: 'min-w-[160px]' },
    { key: 'email',        label: 'Email',        w: 'min-w-[200px]' },
    { key: 'phone_number', label: 'Phone',        w: 'min-w-[140px]' },
  ],
  services: [
    { key: 'service_name', label: 'Service',      w: 'min-w-[180px]' },
    { key: 'status',       label: 'Status',       w: 'min-w-[130px]' },
    { key: 'category',     label: 'Category',     w: 'min-w-[150px]' },
    { key: 'primary_type', label: 'Payment Type', w: 'min-w-[120px]' },
    { key: 'duration',     label: 'Duration (min)',w: 'min-w-[110px]' },
  ],
  membership: [
    { key: 'plan_name',           label: 'Plan Name',          w: 'min-w-[160px]' },
    { key: 'monthly_price',       label: 'Monthly Price',      w: 'min-w-[120px]' },
    { key: 'visits_included',     label: 'Visits',             w: 'min-w-[80px]' },
    { key: 'iv_included',         label: 'IV Sessions',        w: 'min-w-[90px]' },
    { key: 'shots_included',      label: 'Shots',              w: 'min-w-[70px]' },
    { key: 'labs_included',       label: 'Labs',               w: 'min-w-[160px]' },
    { key: 'supplement_discount', label: 'Supplement Discount',w: 'min-w-[150px]' },
    { key: 'description',         label: 'Description',        w: 'min-w-[240px]' },
  ],
}

// Map tab key → supabase table name
const TABLE_NAMES: Record<TabKey, string> = {
  core_functions: 'core_functions',
  systems:        'systems',
  processes:      'processes',
  sops:           'sops',
  roles:          'roles',
  employees:      'employees',
  services:       'services',
  membership:     'membership',
}

// ─── Generic table component ──────────────────────────────────────────────────
function BizTable({ tab, orgId }: { tab: TabKey; orgId: string }) {
  const supabase = createClient()
  const cols = COLUMNS[tab]
  const tableName = TABLE_NAMES[tab]
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(cols[0].key)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [detailRow, setDetailRow] = useState<Row | null>(null)

  const { data, isLoading, refetch } = useQuery<Row[]>({
    queryKey: ['biz', tab, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('org_id', orgId)
        .order(cols[0].key, { ascending: true })
      if (error) {
        // Gracefully handle missing table (not yet in DB)
        console.warn(`Table ${tableName} not found:`, error.message)
        return []
      }
      return (data ?? []) as Row[]
    },
  })

  const rows = data ?? []

  const filtered = rows.filter(row => {
    if (!search) return true
    const q = search.toLowerCase()
    return Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
  }).sort((a, b) => {
    const av = String(a[sortKey] ?? '')
    const bv = String(b[sortKey] ?? '')
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} className="text-[#6b5a47]" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8843a]" />
      : <ChevronDown size={11} className="text-[#c8843a]" />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-toolbar */}
      <div className="px-4 py-2 border-b border-[#2e2016] flex items-center gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5a47]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab.replace('_', ' ')}…`}
            className="bg-[#1e1409] border border-[#2e2016] text-[#c4b49a] text-xs rounded pl-7 pr-3 py-1.5 w-52 outline-none focus:border-[#c8843a] transition-colors" />
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-[#6b5a47] hover:bg-[#2e2016] hover:text-[#c4b49a] transition-colors">
          <RefreshCw size={12} />Refresh
        </button>
        <span className="text-[10px] text-[#6b5a47] ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''} · Read-only reference library</span>
      </div>

      {/* Table + detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#1e1409] border-b border-[#2e2016] sticky top-0 z-10">
                {cols.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className={`${col.w ?? 'min-w-[140px]'} px-3 py-2 text-left font-medium text-[#a08060] cursor-pointer hover:text-[#c4b49a] select-none whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1">{col.label}<SortIcon col={col.key} /></span>
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={cols.length + 1} className="text-center py-16 text-[#6b5a47]">
                  <Loader2 size={18} className="animate-spin inline mr-2" />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={cols.length + 1} className="text-center py-16 text-[#6b5a47]">
                  {search ? 'No records match your search.' : 'No records yet — add them in your database.'}
                </td></tr>
              ) : filtered.map((row, idx) => {
                const isActive = detailRow === row
                return (
                  <tr key={String(row.id ?? idx)}
                    onClick={() => setDetailRow(isActive ? null : row)}
                    className={`border-b border-[#2e2016] cursor-pointer transition-colors
                      ${isActive ? 'bg-[#c8843a]/10' : idx % 2 === 0 ? 'bg-[#1a1410]' : 'bg-[#1c1610]'}
                      hover:bg-[#c8843a]/5`}>
                    {cols.map((col, ci) => (
                      <td key={col.key} className={`px-3 py-2.5 ${ci === 0 ? 'font-medium text-[#c4b49a]' : ''} max-w-[280px]`}>
                        {col.key === 'status' ? <StatusBadge val={row[col.key] as string} /> : <Cell val={row[col.key]} />}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-[#6b5a47]">
                      <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {detailRow && (
          <div className="w-[340px] border-l border-[#2e2016] bg-[#1e1409] flex flex-col overflow-y-auto shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2016] sticky top-0 bg-[#1e1409] z-10">
              <h4 className="text-[#c4b49a] font-semibold text-sm">
                {String(detailRow[cols[0].key] ?? 'Record')}
              </h4>
              <button onClick={() => setDetailRow(null)} className="text-[#6b5a47] hover:text-[#c4b49a] transition-colors"><X size={15} /></button>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              {/* Show ALL fields from the row, not just table columns */}
              {Object.entries(detailRow)
                .filter(([k]) => !['id', 'org_id', 'created_at', 'updated_at'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[#6b5a47] mb-0.5 capitalize">{k.replace(/_/g, ' ')}</p>
                    {k === 'status'
                      ? <StatusBadge val={v as string} />
                      : typeof v === 'string' && v.length > 100
                        ? <p className="text-[#a08060] leading-relaxed whitespace-pre-wrap">{v}</p>
                        : <p className="text-[#c4b49a]"><Cell val={v} /></p>
                    }
                  </div>
                ))
              }
            </div>
            <div className="px-4 py-3 border-t border-[#2e2016] mt-auto">
              <p className="text-[10px] text-[#6b5a47] mb-2">This is a read-only reference record.</p>
              <button onClick={() => setDetailRow(null)}
                className="w-full py-2 text-xs text-[#6b5a47] hover:text-[#c4b49a] border border-[#2e2016] hover:border-[#c8843a]/30 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page content ─────────────────────────────────────────────────────────────
function BusinessMappingContent() {
  const { orgId } = useOrgUser()
  const [activeTab, setActiveTab] = useState<TabKey>('core_functions')

  if (!orgId) return (
    <div className="flex items-center justify-center h-64 text-[#6b5a47]">
      <Loader2 size={20} className="animate-spin mr-2" />Loading…
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-[#c4b49a]">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[#2e2016]">
        <h1 className="text-xl font-semibold text-[#c4b49a]">Business Mapping HQ</h1>
        <p className="text-xs text-[#6b5a47] mt-0.5">
          Read-only reference library — Core Functions, Systems, Processes, SOPs, Roles, Employees, Services, Membership
        </p>
      </div>

      {/* Tab bar */}
      <div className="px-4 border-b border-[#2e2016] flex items-end gap-0.5 overflow-x-auto bg-[#1a1410]">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
              ${activeTab === tab.key
                ? 'border-[#c8843a] text-[#c8843a]'
                : 'border-transparent text-[#6b5a47] hover:text-[#c4b49a] hover:border-[#2e2016]'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Active table */}
      <div className="flex-1 overflow-hidden">
        <BizTable key={activeTab} tab={activeTab} orgId={orgId} />
      </div>
    </div>
  )
}

export default function BusinessMappingPage() {
  return (
    <RoleGuard allow={['admin']}>
      <BusinessMappingContent />
    </RoleGuard>
  )
}