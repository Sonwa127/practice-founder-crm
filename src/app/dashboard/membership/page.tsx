'use client';

// src/app/dashboard/membership/page.tsx
// Membership Plans — Table 1D in the SmartSuite spec.
// This is a PLAN CATALOG (Wellness Basic, Wellness Plus, Concierge Elite, etc.)
// NOT a member count tracker.
//
// Fields from spec: plan_name, description, monthly_price, visits_included,
//   iv_included, shots_included, labs_included, supplement_discount, status.
//
// UX:
//   - Left-side expand button (no horizontal scroll needed to open records)
//   - RecordComments on every detail panel
//   - Bulk delete with checkbox selection
//   - Admin only

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import RecordComments from '@/components/RecordComments';
import RoleGuard from '@/components/RoleGuard';
import {
  Plus, Search, X, Check, Trash2, RefreshCw, FileDown,
  ChevronDown, ChevronUp, Maximize2, Save, Edit2, Package,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanStatus = 'Active' | 'Paused' | 'Archived';

interface MembershipPlan {
  id: string;
  org_id: string;
  plan_name: string;
  description: string;
  status: PlanStatus;
  monthly_price: number;
  visits_included: number;
  iv_included: number;
  shots_included: number;
  labs_included: string;
  supplement_discount: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

type FormData = Omit<MembershipPlan, 'id' | 'org_id' | 'created_at' | 'updated_at'>;

const EMPTY: FormData = {
  plan_name: '', description: '', status: 'Active',
  monthly_price: 0, visits_included: 0, iv_included: 0,
  shots_included: 0, labs_included: '', supplement_discount: '', notes: '',
};

const STATUS_OPTS: PlanStatus[] = ['Active', 'Paused', 'Archived'];
const STATUS_STYLE: Record<PlanStatus, string> = {
  Active:   'bg-green-900/30 text-green-400 border border-green-800/40',
  Paused:   'bg-yellow-900/30 text-yellow-400 border border-yellow-800/40',
  Archived: 'bg-[#2e2016] text-[#6b5a47] border border-[#3a2a1a]',
};

const DEMO: MembershipPlan[] = [
  { id:'d1', org_id:'demo', plan_name:'Wellness Basic',  description:'Entry-level wellness — ideal for health-conscious patients.',    status:'Active',   monthly_price:99,  visits_included:1, iv_included:0, shots_included:0, labs_included:'Basic metabolic panel',                                supplement_discount:'10% off all supplements', notes:'Most popular for new patients.',            created_at:'2026-01-15T00:00:00Z', updated_at:'2026-04-01T00:00:00Z' },
  { id:'d2', org_id:'demo', plan_name:'Wellness Plus',   description:'Enhanced wellness with IV therapy and comprehensive labs.',       status:'Active',   monthly_price:199, visits_included:2, iv_included:1, shots_included:2, labs_included:'Full metabolic panel + thyroid + CBC',                  supplement_discount:'15% off all supplements', notes:'Recommended for chronic-condition patients.', created_at:'2026-01-15T00:00:00Z', updated_at:'2026-04-01T00:00:00Z' },
  { id:'d3', org_id:'demo', plan_name:'Concierge Elite', description:'All-inclusive concierge care — priority scheduling, full IV.',    status:'Active',   monthly_price:349, visits_included:4, iv_included:2, shots_included:4, labs_included:'Full panel + specialty markers + annual imaging review', supplement_discount:'20% off all supplements', notes:"Dr. Evans' most engaged patients.",          created_at:'2026-01-15T00:00:00Z', updated_at:'2026-04-15T00:00:00Z' },
  { id:'d4', org_id:'demo', plan_name:'Legacy Member',   description:'Grandfathered plan — no longer sold but still honoured.',         status:'Archived', monthly_price:79,  visits_included:1, iv_included:0, shots_included:1, labs_included:'Basic panel',                                           supplement_discount:'5% off',                  notes:'Do not upsell — honour existing terms.',    created_at:'2025-06-01T00:00:00Z', updated_at:'2026-03-01T00:00:00Z' },
];

const fmtUSD  = (n: number) => new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n??0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown<T extends string>({ value, options, onChange }: { value:T; options:T[]; onChange:(v:T)=>void }) {
  const [open,setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e:MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h); return () => document.removeEventListener('mousedown',h);
  },[]);
  return (
    <div ref={ref} className="relative">
      <button onClick={()=>setOpen(v=>!v)} className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#261c12] border border-[#3a2a1a] hover:border-[#c8843a] transition text-sm text-[#c4b49a]">
        <span>{value}</span><ChevronDown className="w-3.5 h-3.5 text-[#6b5a47] ml-2"/>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-[#231810] border border-[#3a2a1a] rounded-lg shadow-2xl py-1">
          {options.map(opt=>(
            <button key={opt} onClick={()=>{onChange(opt);setOpen(false);}} className={`flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2e1f0f] text-left text-sm ${value===opt?'text-[#c8843a]':'text-[#c4b49a]'}`}>
              {value===opt?<Check className="w-3 h-3"/>:<span className="w-3"/>}{opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Plan Form ────────────────────────────────────────────────────────────────

function PlanForm({ initial={}, onSave, onCancel, saving }: {
  initial?: Partial<FormData>; onSave:(d:FormData)=>void; onCancel:()=>void; saving?:boolean;
}) {
  const [form,setForm] = useState<FormData>({...EMPTY,...initial});
  const set = (k:string,v:unknown) => setForm(p=>({...p,[k]:v}));
  const iCls = 'w-full px-2.5 py-1.5 rounded-lg bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition';
  const lCls = 'block text-[10px] text-[#6b5a47] uppercase tracking-wider mb-0.5';
  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-3">Plan Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lCls}>Plan Name *</label><input value={form.plan_name} onChange={e=>set('plan_name',e.target.value)} className={iCls} placeholder="e.g. Wellness Plus"/></div>
            <div><label className={lCls}>Status</label><Dropdown value={form.status} options={STATUS_OPTS} onChange={v=>set('status',v)}/></div>
            <div><label className={lCls}>Monthly Price ($)</label><input type="number" value={form.monthly_price} min={0} onChange={e=>set('monthly_price',parseFloat(e.target.value)||0)} className={iCls} placeholder="0"/></div>
            <div className="col-span-2"><label className={lCls}>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} className={`${iCls} resize-none`} placeholder="What does this plan include?"/></div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-3">Inclusions</p>
          <div className="grid grid-cols-3 gap-3">
            {[['Visits / Month','visits_included'],['IV Sessions','iv_included'],['Shots / Month','shots_included']].map(([label,key])=>(
              <div key={key}><label className={lCls}>{label}</label><input type="number" value={(form as Record<string,unknown>)[key] as number} min={0} onChange={e=>set(key,parseInt(e.target.value)||0)} className={iCls} placeholder="0"/></div>
            ))}
            <div className="col-span-2"><label className={lCls}>Labs Included</label><input value={form.labs_included} onChange={e=>set('labs_included',e.target.value)} className={iCls} placeholder="e.g. Full metabolic + CBC"/></div>
            <div><label className={lCls}>Supplement Discount</label><input value={form.supplement_discount} onChange={e=>set('supplement_discount',e.target.value)} className={iCls} placeholder="e.g. 15%"/></div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#c8843a] uppercase tracking-wider mb-3">Notes</p>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} className={`${iCls} resize-none`} placeholder="Internal notes, caveats, special terms…"/>
        </div>
      </div>
      <div className="flex gap-2 px-6 py-4 border-t border-[#2e2016] flex-shrink-0">
        <button onClick={()=>onSave(form)} disabled={!form.plan_name.trim()||saving} className="flex-1 py-2 rounded-lg bg-[#c8843a] hover:bg-[#d9944a] disabled:opacity-40 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
          {saving?<RefreshCw className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?'Saving…':'Save Plan'}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg border border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a] text-sm transition">Cancel</button>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ plan, orgId, onClose, onEdit, onDelete }: {
  plan: MembershipPlan; orgId: string; onClose:()=>void; onEdit:()=>void; onDelete:()=>void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative w-full max-w-lg bg-[#1e1409] border-l border-[#3a2a1a] h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2e2016] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium mb-1 ${STATUS_STYLE[plan.status]}`}>
              {plan.status==='Active'&&<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}{plan.status}
            </span>
            <h2 className="font-bold text-white text-lg leading-tight">{plan.plan_name}</h2>
            <p className="text-xs text-[#6b5a47] mt-0.5">Updated {fmtDate(plan.updated_at)}</p>
          </div>
          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-[#a08060] hover:bg-[#2e1f0f] hover:text-[#e8a05a] transition"><Edit2 className="w-4 h-4"/></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-[#a08060] hover:bg-red-900/20 hover:text-red-400 transition"><Trash2 className="w-4 h-4"/></button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b5a47] hover:text-white transition"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="px-5 py-4 bg-gradient-to-r from-[#1e1409] to-[#251810] border-b border-[#2e2016] flex-shrink-0">
          <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest mb-0.5">Monthly Price</p>
          <p className="text-3xl font-bold text-[#c8843a]">{fmtUSD(plan.monthly_price)}<span className="text-base text-[#6b5a47] font-normal">/mo</span></p>
        </div>
        <div className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
          {plan.description && (
            <div>
              <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest border-b border-[#2e2016] pb-1 mb-3">Description</p>
              <p className="text-sm text-[#c4b49a] leading-relaxed">{plan.description}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest border-b border-[#2e2016] pb-1 mb-3">Inclusions</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {([['Visits / Month', plan.visits_included],['IV Therapy', plan.iv_included],['Shots', plan.shots_included]] as [string,number][]).map(([label,val])=>(
                <div key={label} className="bg-[#261c12] border border-[#2e2016] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{val}</p>
                  <p className="text-[10px] text-[#6b5a47] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['Labs Included', plan.labs_included],['Supplement Discount', plan.supplement_discount]] as [string,string][]).map(([label,val])=>(
                <div key={label}>
                  <p className="text-[10px] text-[#6b5a47] mb-0.5">{label}</p>
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#261c12] border border-[#2e2016] text-sm text-[#c4b49a]">
                    {val||<span className="text-[#4b3a2a] italic">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {plan.notes && (
            <div>
              <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest border-b border-[#2e2016] pb-1 mb-3">Notes</p>
              <div className="px-3 py-2.5 rounded-lg bg-[#261c12] border border-[#2e2016] text-sm text-[#c4b49a] leading-relaxed">{plan.notes}</div>
            </div>
          )}
          <div>
            <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest border-b border-[#2e2016] pb-1 mb-3">Metadata</p>
            <div className="grid grid-cols-2 gap-3">
              {([['Created', fmtDate(plan.created_at)],['Last Updated', fmtDate(plan.updated_at)]] as [string,string][]).map(([label,val])=>(
                <div key={label}>
                  <p className="text-[10px] text-[#6b5a47] mb-0.5">{label}</p>
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#261c12] border border-[#2e2016] text-sm text-[#c4b49a]">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Comment section on every record — per spec requirement */}
        {orgId && orgId !== 'demo' && (
          <RecordComments recordId={plan.id} tableName="membership_plans" orgId={orgId}/>
        )}
        <div className="px-5 py-3 border-t border-[#2e2016] flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function MembershipContent() {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { orgId, isLoading: authLoading } = useOrgUser();
  const qc = useQueryClient();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus|'All'>('All');
  const [sortKey,      setSortKey]      = useState<keyof MembershipPlan>('monthly_price');
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('asc');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [detailPlan,   setDetailPlan]   = useState<MembershipPlan|null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editPlan,     setEditPlan]     = useState<MembershipPlan|null>(null);
  const [localPlans,   setLocalPlans]   = useState<MembershipPlan[]>(DEMO);

  const { isLoading, refetch } = useQuery({
    queryKey: ['membership-plans', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      try {
        const { data, error } = await supabase.from('membership_plans').select('*').eq('org_id', orgId).order('monthly_price',{ascending:true});
        if (!error && data?.length) setLocalPlans(data as MembershipPlan[]);
      } catch { /* use demo */ }
      return null;
    },
    enabled: !authLoading,
  });

  const createMut = useMutation({
    mutationFn: async (data: FormData) => {
      if (!orgId||orgId==='demo') { setLocalPlans(p=>[...p,{...data,id:crypto.randomUUID(),org_id:'demo',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]); return; }
      const {error} = await supabase.from('membership_plans').insert({...data,org_id:orgId});
      if (error) throw error; await refetch();
    },
    onSuccess: () => { setShowCreate(false); qc.invalidateQueries({queryKey:['membership-plans']}); },
  });

  const updateMut = useMutation({
    mutationFn: async ({id,data}:{id:string;data:FormData}) => {
      if (!orgId||orgId==='demo') { setLocalPlans(p=>p.map(pl=>pl.id===id?{...pl,...data,updated_at:new Date().toISOString()}:pl)); return; }
      const {error} = await supabase.from('membership_plans').update({...data,updated_at:new Date().toISOString()}).eq('id',id).eq('org_id',orgId);
      if (error) throw error; await refetch();
    },
    onSuccess: () => { setEditPlan(null); setDetailPlan(null); qc.invalidateQueries({queryKey:['membership-plans']}); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId||orgId==='demo') { setLocalPlans(p=>p.filter(pl=>pl.id!==id)); return; }
      const {error} = await supabase.from('membership_plans').delete().eq('id',id).eq('org_id',orgId);
      if (error) throw error; await refetch();
    },
    onSuccess: () => { setDetailPlan(null); qc.invalidateQueries({queryKey:['membership-plans']}); },
  });

  const bulkDelete = useCallback(async () => {
    if (!selectedIds.size) return;
    if (!orgId||orgId==='demo') { setLocalPlans(p=>p.filter(pl=>!selectedIds.has(pl.id))); setSelectedIds(new Set()); return; }
    await supabase.from('membership_plans').delete().in('id',[...selectedIds]).eq('org_id',orgId);
    setSelectedIds(new Set()); await refetch();
  }, [selectedIds, orgId, refetch, supabase]);

  const plans = useCallback(():MembershipPlan[] => {
    let r = [...localPlans];
    if (statusFilter!=='All') r=r.filter(p=>p.status===statusFilter);
    if (search) { const q=search.toLowerCase(); r=r.filter(p=>p.plan_name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)||p.notes.toLowerCase().includes(q)); }
    r.sort((a,b)=>{ const av=a[sortKey]; const bv=b[sortKey]; const c=av<bv?-1:av>bv?1:0; return sortDir==='asc'?c:-c; });
    return r;
  },[localPlans,statusFilter,search,sortKey,sortDir])();

  const active = localPlans.filter(p=>p.status==='Active');
  const avgPrice = active.length ? active.reduce((s,p)=>s+p.monthly_price,0)/active.length : 0;
  const maxVisits = active.length ? Math.max(...active.map(p=>p.visits_included)) : 0;

  const toggleSort = (key:keyof MembershipPlan) => { if(sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const SortIcon = ({col}:{col:keyof MembershipPlan}) => sortKey===col?(sortDir==='asc'?<ChevronUp className="w-3 h-3 text-[#c8843a]"/>:<ChevronDown className="w-3 h-3 text-[#c8843a]"/>):<ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30"/>;

  const exportCSV = () => {
    const cols: (keyof MembershipPlan)[] = ['plan_name','status','monthly_price','visits_included','iv_included','shots_included','labs_included','supplement_discount','notes'];
    const h=cols.join(','); const b=plans.map(p=>cols.map(c=>`"${p[c]??''}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([h+'\n'+b],{type:'text/csv'})),download:`membership-plans-${new Date().toISOString().slice(0,10)}.csv`}).click();
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex-shrink-0">
        <p className="text-xs text-[#6b5a47]">Business Mapping › Membership</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Membership Plans</h1>
        <p className="text-sm text-[#6b5a47] mt-1">All membership tiers offered by Dr. Evans&apos; practice.</p>
      </div>

      {/* Stats */}
      <div className="px-6 pb-3 flex-shrink-0 grid grid-cols-4 gap-3">
        {([['Active Plans',String(active.length),'currently available'],['Avg Price',fmtUSD(avgPrice),'across active plans'],['Max Visits / Plan',String(maxVisits),'visits per month'],['Total Plans',String(localPlans.length),`${localPlans.filter(p=>p.status==='Archived').length} archived`]] as [string,string,string][]).map(([label,val,sub])=>(
          <div key={label} className="bg-[#1e1409] border border-[#2e2016] rounded-xl px-5 py-4">
            <p className="text-[10px] text-[#6b5a47] uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{val}</p>
            <p className="text-xs text-[#6b5a47] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-2 border-b border-[#2e2016] bg-[#1a1410] z-30">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b5a47]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plans…" className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#221710] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition"/>
            {search&&<button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b5a47] hover:text-white"><X className="w-3 h-3"/></button>}
          </div>
          <div className="flex items-center gap-1">
            {(['All',...STATUS_OPTS] as (PlanStatus|'All')[]).map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${statusFilter===s?'bg-[#c8843a]/15 border-[#c8843a]/60 text-[#e8a05a]':'bg-[#221710] border-[#3a2a1a] text-[#a08060] hover:border-[#c8843a]/60'}`}>{s}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-[#3a2a1a] mx-1"/>
          <button onClick={()=>refetch()} className="p-1.5 rounded-lg text-[#a08060] hover:text-white border border-[#3a2a1a] hover:border-[#c8843a] transition"><RefreshCw className="w-3.5 h-3.5"/></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#3a2a1a] bg-[#221710] text-[#a08060] hover:border-[#c8843a] hover:text-[#e8a05a] text-sm transition"><FileDown className="w-3.5 h-3.5"/>Export</button>
          <div className="ml-auto">
            <button onClick={()=>setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c8843a] hover:bg-[#d9944a] text-white text-sm font-semibold transition"><Plus className="w-4 h-4"/>New Plan</button>
          </div>
        </div>
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-lg bg-[#c8843a]/10 border border-[#c8843a]/30">
            <span className="text-sm text-[#e8a05a] font-medium">{selectedIds.size} selected</span>
            <button onClick={bulkDelete} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition"><Trash2 className="w-3.5 h-3.5"/>Delete selected</button>
            <button onClick={()=>setSelectedIds(new Set())} className="ml-auto text-[#6b5a47] hover:text-white"><X className="w-4 h-4"/></button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse min-w-[860px]">
          <thead className="sticky top-0 z-10 bg-[#1e1409]">
            <tr>
              <th className="w-10 px-3 py-2 border-b border-r border-[#2e2016]">
                <input type="checkbox" checked={selectedIds.size===plans.length&&plans.length>0}
                  onChange={()=>selectedIds.size===plans.length?setSelectedIds(new Set()):setSelectedIds(new Set(plans.map(p=>p.id)))}
                  className="accent-[#c8843a] cursor-pointer"/>
              </th>
              {/* LEFT-side expand col — no horizontal scroll required */}
              <th className="w-8 border-b border-r border-[#2e2016]"/>
              {([
                {label:'Plan Name',    key:'plan_name'          as keyof MembershipPlan, w:'220px'},
                {label:'Status',       key:'status'             as keyof MembershipPlan, w:'100px'},
                {label:'Price / Mo',   key:'monthly_price'      as keyof MembershipPlan, w:'110px'},
                {label:'Visits',       key:'visits_included'    as keyof MembershipPlan, w:'70px' },
                {label:'IV',           key:'iv_included'        as keyof MembershipPlan, w:'60px' },
                {label:'Shots',        key:'shots_included'     as keyof MembershipPlan, w:'70px' },
                {label:'Labs',         key:'labs_included'      as keyof MembershipPlan, w:'auto' },
                {label:'Supplement %', key:'supplement_discount'as keyof MembershipPlan, w:'130px'},
              ]).map(col=>(
                <th key={col.key} style={{width:col.w,minWidth:col.w}} className="border-b border-r border-[#2e2016] px-3 py-2 text-left group">
                  <button onClick={()=>toggleSort(col.key)} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#a08060] hover:text-[#e8c07a] transition whitespace-nowrap">
                    {col.label} <SortIcon col={col.key}/>
                  </button>
                </th>
              ))}
              <th className="border-b border-[#2e2016] w-8"/>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={12} className="py-16 text-center"><RefreshCw className="w-5 h-5 animate-spin text-[#c8843a] mx-auto"/></td></tr>}
            {!isLoading&&plans.length===0&&<tr><td colSpan={12} className="py-16 text-center text-[#6b5a47] text-sm">No plans match your filters.</td></tr>}
            {plans.map(plan=>(
              <tr key={plan.id} onClick={()=>setDetailPlan(plan)}
                className={`border-b border-[#2a1c10] transition cursor-pointer group/row ${selectedIds.has(plan.id)?'bg-[#c8843a]/10':'hover:bg-[#221610]'} ${plan.status==='Archived'?'opacity-60':''}`}>
                <td className="w-10 px-3 py-3 border-r border-[#2a1c10]" onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(plan.id)}
                    onChange={()=>setSelectedIds(p=>{const n=new Set(p);n.has(plan.id)?n.delete(plan.id):n.add(plan.id);return n;})}
                    className="accent-[#c8843a] cursor-pointer"/>
                </td>
                {/* LEFT-side expand — visible on row hover */}
                <td className="w-8 border-r border-[#2a1c10] py-3" onClick={e=>{e.stopPropagation();setDetailPlan(plan);}}>
                  <button className="opacity-0 group-hover/row:opacity-100 transition flex items-center justify-center w-full h-full text-[#6b5a47] hover:text-[#c8843a]"><Maximize2 className="w-3.5 h-3.5"/></button>
                </td>
                <td className="px-3 py-3 border-r border-[#2a1c10]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#c8843a]/15 border border-[#c8843a]/30 flex items-center justify-center flex-shrink-0"><Package className="w-4 h-4 text-[#c8843a]"/></div>
                    <div>
                      <p className="text-sm font-semibold text-white">{plan.plan_name}</p>
                      {plan.description&&<p className="text-xs text-[#6b5a47] truncate max-w-[160px]">{plan.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 border-r border-[#2a1c10]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[plan.status]}`}>
                    {plan.status==='Active'&&<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}{plan.status}
                  </span>
                </td>
                <td className="px-3 py-3 border-r border-[#2a1c10] text-right">
                  <span className="font-bold text-[#c8843a] text-sm">{fmtUSD(plan.monthly_price)}</span><span className="text-[10px] text-[#6b5a47]">/mo</span>
                </td>
                {[plan.visits_included,plan.iv_included,plan.shots_included].map((v,i)=>(
                  <td key={i} className="px-3 py-3 border-r border-[#2a1c10] text-center"><span className="text-sm font-semibold text-white">{v}</span></td>
                ))}
                <td className="px-3 py-3 border-r border-[#2a1c10]"><span className="text-xs text-[#a08060] truncate block max-w-[220px]">{plan.labs_included||'—'}</span></td>
                <td className="px-3 py-3 border-r border-[#2a1c10]"><span className="text-sm text-[#c4b49a]">{plan.supplement_discount||'—'}</span></td>
                <td className="w-8"/>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 px-4 py-2 border-t border-[#2e2016] bg-[#1a1410] flex items-center text-xs text-[#6b5a47]">
        <span>Showing <span className="text-[#a08060] font-medium">{plans.length}</span> of <span className="text-[#a08060] font-medium">{localPlans.length}</span> plans</span>
      </div>

      {detailPlan&&!editPlan&&(
        <DetailPanel plan={detailPlan} orgId={orgId??'demo'} onClose={()=>setDetailPlan(null)} onEdit={()=>setEditPlan(detailPlan)} onDelete={()=>deleteMut.mutate(detailPlan.id)}/>
      )}
      {showCreate&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowCreate(false)}/>
          <div className="relative w-full max-w-xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2016]"><h2 className="font-bold text-white text-lg">New Membership Plan</h2><button onClick={()=>setShowCreate(false)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5"/></button></div>
            <PlanForm onSave={data=>createMut.mutate(data)} onCancel={()=>setShowCreate(false)} saving={createMut.isPending}/>
          </div>
        </div>
      )}
      {editPlan&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setEditPlan(null)}/>
          <div className="relative w-full max-w-xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2016]"><h2 className="font-bold text-white text-lg">Edit Plan</h2><button onClick={()=>setEditPlan(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5"/></button></div>
            <PlanForm initial={editPlan} onSave={data=>updateMut.mutate({id:editPlan.id,data})} onCancel={()=>setEditPlan(null)} saving={updateMut.isPending}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembershipPage() {
  return (
    <RoleGuard allow={['admin']}>
      <MembershipContent/>
    </RoleGuard>
  );
}