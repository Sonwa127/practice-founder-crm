'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { useOrgUser } from '@/lib/useOrgUser';
import { useEmployeeNames } from '@/lib/useEmployeeNames';
import {
  Search, X, Plus, ChevronDown, ChevronUp, Info,
  RefreshCw, Download, Upload, Eye, Grid, List,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceptionistRow {
  [key: string]: unknown;
  id: string; org_id: string; submitted_by: string; date: string;
  no_shows: number; reschedules: number; non_billable_phone_calls: number;
  referrals: number; total_patient_encounters: number; same_day_addons: number;
  cash_collected: number; credit_card_collected: number; check_collected: number;
  total_collections: number;
  awv: number; cpe: number; new_cpe: number; wcc: number; wwe: number;
  immigration_physical: number; new_patients: number; follow_up_visits: number;
  sick_visits: number; nurse_visits: number; ccm: number; telehealth_visits: number;
  wellness_evaluation: number; wellness_follow_up: number; wellness_shots: number;
  iv_therapy: number; pellet_insertion: number; joint_injection: number;
  home_mobile_visits: number;
  collection_rate?: number;
}

const EMPTY_FORM: Record<string, unknown> = {
  submitted_by: '', date: new Date().toISOString().slice(0, 10),
  no_shows: 0, reschedules: 0, non_billable_phone_calls: 0, referrals: 0,
  total_patient_encounters: 0, same_day_addons: 0,
  cash_collected: 0, credit_card_collected: 0, check_collected: 0,
  awv: 0, cpe: 0, new_cpe: 0, wcc: 0, wwe: 0, immigration_physical: 0,
  new_patients: 0, follow_up_visits: 0, sick_visits: 0, nurse_visits: 0,
  ccm: 0, telehealth_visits: 0, wellness_evaluation: 0, wellness_follow_up: 0,
  wellness_shots: 0, iv_therapy: 0, pellet_insertion: 0, joint_injection: 0,
  home_mobile_visits: 0,
};

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  awv: 'Annual Wellness Visit — Medicare-covered preventive visit for patients 65+. Focuses on health risk assessment and personalized prevention plan. Does NOT include a head-to-toe exam.',
  cpe: 'Comprehensive Physical Exam — Full head-to-toe physical for an existing patient. Billed as a preventive visit for established patients.',
  new_cpe: 'New CPE — Same scope as CPE but for a NEW patient to this practice. Billed at a higher rate for new patient first visits.',
  wcc: 'Well Child Check — Preventive wellness visit for pediatric patients. Includes age-appropriate developmental screenings, immunizations review, and growth monitoring.',
  wwe: 'Well Woman Exam — Annual gynecological wellness visit. Includes pelvic exam, breast exam, and any indicated cancer screenings such as Pap smear.',
  immigration_physical: 'Immigration Physical — USCIS-required medical examination for immigration applicants. Must be conducted by a USCIS-designated civil surgeon.',
  new_patients: 'New Patients — Patients visiting this practice for the very first time. Billed as a new patient evaluation.',
  follow_up_visits: 'Follow-Up Visits — Established patients returning to follow up on a previously addressed condition, lab result, or treatment plan.',
  sick_visits: 'Sick Visits — Unscheduled or same-day visits for acute illness or injury. Count only visits completed today.',
  nurse_visits: 'Nurse Visits — Visits managed and completed by nursing staff without direct physician involvement (e.g. vaccine administration, wound care, blood draw).',
  ccm: 'Chronic Care Management — Medicare program for patients with two or more chronic conditions. Monthly coordination and care plan management. Does not require an in-person visit.',
  telehealth_visits: 'Telehealth Visits — Video or phone-based visits conducted remotely. Count only completed telehealth encounters.',
  wellness_evaluation: 'Wellness Evaluation — Initial consultation for a patient beginning a wellness or optimization program. Includes health history review, goal setting, and program design.',
  wellness_follow_up: 'Wellness Follow-Up — Follow-up for a patient already enrolled in a wellness program. Tracks progress and adjusts plan as needed.',
  wellness_shots: 'Wellness Shots — Administration of a wellness injection (e.g. vitamin B12, vitamin D, immune support). Count each administration as one visit.',
  iv_therapy: 'IV Therapy — Administration of vitamins, minerals, or other nutrients directly into the bloodstream via IV line. Each session = one count.',
  pellet_insertion: 'Pellet Insertion — Subcutaneous implantation of hormone pellets for bioidentical hormone replacement therapy. Count each procedure performed today.',
  joint_injection: 'Joint Injection — Injection of corticosteroid, hyaluronic acid, or PRP into a joint for pain relief. Each injection = one count, regardless of joint.',
  home_mobile_visits: 'Home / Mobile Visit — Physician or clinical staff traveled to a patient\'s home or off-site location to deliver care. Count each visit made today.',
  total_patient_encounters: 'Total unique patients seen today across all visit types.',
  same_day_addons: 'Patients added to the schedule on the same day they were seen. These were not on yesterday\'s schedule.',
  no_shows: 'Patients who had a scheduled appointment but did not arrive and did not cancel in advance.',
  reschedules: 'Appointments moved to a future date today — whether by the patient or the practice.',
  non_billable_phone_calls: 'Inbound or outbound phone calls completed today that cannot be billed to insurance.',
  referrals: 'The number of referrals issued today by the provider. A referral is a formal recommendation for a patient to see a specialist or receive a specific service.',
  cash_collected: 'Patient payments collected in cash today.',
  credit_card_collected: 'Patient payments collected via credit or debit card today.',
  check_collected: 'Patient payments collected via check today.',
  total_collections: 'Auto-calculated: Cash + Credit Card + Check collected today.',
  collection_rate: 'Formula: (Total Collections ÷ Total Charges Submitted from billing for same date) × 100. Shows N/A if no billing record exists for this date.',
  referral_completion_rate: 'Formula: (Referrals ÷ Total Patients Encountered by physician today) × 100. Shows N/A if no physician record exists for this date.',
};

// ─── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'submitted_by',             label: 'Submitted By',           width: 140, group: 'Core' },
  { key: 'date',                     label: 'Date',                   width: 110, group: 'Core' },
  { key: 'awv',                      label: 'AWV',                    width: 60,  group: 'Preventive Care' },
  { key: 'cpe',                      label: 'CPE',                    width: 60,  group: 'Preventive Care' },
  { key: 'new_cpe',                  label: 'New CPE',                width: 80,  group: 'Preventive Care' },
  { key: 'wcc',                      label: 'WCC',                    width: 60,  group: 'Preventive Care' },
  { key: 'wwe',                      label: 'WWE',                    width: 60,  group: 'Preventive Care' },
  { key: 'immigration_physical',     label: 'IP',                     width: 60,  group: 'Preventive Care' },
  { key: 'new_patients',             label: 'New Patients',           width: 100, group: 'Problem-Based' },
  { key: 'follow_up_visits',         label: 'Follow-Ups',             width: 90,  group: 'Problem-Based' },
  { key: 'sick_visits',              label: 'Sick Visits',            width: 90,  group: 'Problem-Based' },
  { key: 'nurse_visits',             label: 'Nurse Visits',           width: 100, group: 'Problem-Based' },
  { key: 'ccm',                      label: 'CCM',                    width: 60,  group: 'Problem-Based' },
  { key: 'telehealth_visits',        label: 'Telehealth',             width: 90,  group: 'Problem-Based' },
  { key: 'wellness_evaluation',      label: 'Wellness Eval',          width: 100, group: 'Wellness' },
  { key: 'wellness_follow_up',       label: 'Wellness F/U',           width: 100, group: 'Wellness' },
  { key: 'wellness_shots',           label: 'Wellness Shots',         width: 110, group: 'Wellness' },
  { key: 'iv_therapy',               label: 'IV Therapy',             width: 90,  group: 'Procedures' },
  { key: 'pellet_insertion',         label: 'Pellet Ins.',            width: 90,  group: 'Procedures' },
  { key: 'joint_injection',          label: 'Joint Inj.',             width: 90,  group: 'Procedures' },
  { key: 'home_mobile_visits',       label: 'Home/Mobile',            width: 100, group: 'Procedures' },
  { key: 'total_patient_encounters', label: 'Total Encounters',       width: 130, group: 'Operations' },
  { key: 'same_day_addons',          label: 'Same-Day Add-Ons',       width: 130, group: 'Operations' },
  { key: 'no_shows',                 label: 'No-Shows',               width: 90,  group: 'Operations' },
  { key: 'reschedules',              label: 'Reschedules',            width: 110, group: 'Operations' },
  { key: 'non_billable_phone_calls', label: 'Non-Billable Calls',     width: 140, group: 'Operations' },
  { key: 'referrals',                label: 'Referrals',              width: 90,  group: 'Operations' },
  { key: 'cash_collected',           label: 'Cash ($)',               width: 90,  group: 'Collections' },
  { key: 'credit_card_collected',    label: 'Card ($)',               width: 90,  group: 'Collections' },
  { key: 'check_collected',          label: 'Check ($)',              width: 90,  group: 'Collections' },
  { key: 'total_collections',        label: 'Total Collections ($)',  width: 140, group: 'Collections' },
  { key: 'collection_rate',          label: 'Collection Rate (%)',    width: 140, group: 'Collections' },
];

const CURRENCY_FIELDS = new Set(['cash_collected','credit_card_collected','check_collected','total_collections']);
const PERCENT_FIELDS  = new Set(['collection_rate']);
const NUMERIC_FIELDS  = new Set(COLUMNS.map(c => c.key).filter(k => !CURRENCY_FIELDS.has(k) && !PERCENT_FIELDS.has(k) && k !== 'submitted_by' && k !== 'date'));

const DEMO_ROWS: ReceptionistRow[] = [
  { id:'d1', org_id:'demo', submitted_by:'Receptionist', date:'2026-05-11',
    no_shows:2, reschedules:1, non_billable_phone_calls:5, referrals:3,
    total_patient_encounters:18, same_day_addons:2,
    cash_collected:120, credit_card_collected:540, check_collected:0, total_collections:660,
    awv:2, cpe:3, new_cpe:1, wcc:0, wwe:2, immigration_physical:0,
    new_patients:1, follow_up_visits:4, sick_visits:3, nurse_visits:2, ccm:1, telehealth_visits:2,
    wellness_evaluation:1, wellness_follow_up:1, wellness_shots:2,
    iv_therapy:1, pellet_insertion:0, joint_injection:1, home_mobile_visits:0,
    collection_rate: 82 },
  { id:'d2', org_id:'demo', submitted_by:'Receptionist', date:'2026-05-10',
    no_shows:1, reschedules:3, non_billable_phone_calls:8, referrals:2,
    total_patient_encounters:21, same_day_addons:4,
    cash_collected:200, credit_card_collected:720, check_collected:150, total_collections:1070,
    awv:3, cpe:4, new_cpe:2, wcc:1, wwe:1, immigration_physical:1,
    new_patients:2, follow_up_visits:5, sick_visits:4, nurse_visits:3, ccm:0, telehealth_visits:1,
    wellness_evaluation:0, wellness_follow_up:2, wellness_shots:1,
    iv_therapy:2, pellet_insertion:1, joint_injection:0, home_mobile_visits:0,
    collection_rate: 91 },
];

// ─── Tooltip component ─────────────────────────────────────────────────────────
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

// ─── Section banner ───────────────────────────────────────────────────────────
function SectionBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#2a1e10]/60 border border-[#3a2a1a] rounded-lg px-4 py-3 mb-3">
      <div className="text-[#c8843a] text-xs font-bold uppercase tracking-widest mb-0.5">{title}</div>
      <div className="text-[#c4b49a]/60 text-xs">{description}</div>
    </div>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────
function NInput({ label, field, value, onChange, required = true }: {
  label: string; field: string; value: number; onChange: (v: number) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50 mb-1">
        {label}{required && <span className="text-[#c8843a] ml-0.5">*</span>}<Tip field={field} />
      </label>
      <input
        type="number" min={0} value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8843a] transition-colors"
      />
    </div>
  );
}

// ─── Currency input ───────────────────────────────────────────────────────────
function CInput({ label, field, value, onChange }: {
  label: string; field: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50 mb-1">
        {label}<span className="text-[#c8843a] ml-0.5">*</span><Tip field={field} />
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b5a47] text-sm">$</span>
        <input
          type="number" min={0} step={0.01} value={value}
          onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-full bg-[#1a1410] border border-[#2e2016] rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8843a] transition-colors"
        />
      </div>
    </div>
  );
}

// ─── New Record Form ──────────────────────────────────────────────────────────
function NewReceptionistForm({ onSave, onCancel, defaultSubmittedBy }: {
  onSave: (row: ReceptionistRow) => void;
  onCancel: () => void;
  defaultSubmittedBy: string;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({ ...EMPTY_FORM, submitted_by: defaultSubmittedBy });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { orgId } = useOrgUser();

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const n = (k: string) => Number(form[k] ?? 0);
  const s = (k: string) => String(form[k] ?? '');
  const total = n('cash_collected') + n('credit_card_collected') + n('check_collected');

  async function handleSave() {
    if (!s('submitted_by').trim()) { setError('Submitted By is required.'); return; }
    if (!s('date')) { setError('Date is required.'); return; }
    setError(''); setSaving(true);

    const isDemo = !orgId;
    if (isDemo) {
      onSave({ ...form, id: crypto.randomUUID(), org_id: 'demo', total_collections: total } as ReceptionistRow); return;
    }
    const { data, error: err } = await supabase
      .from('receptionist_tracker')
      .insert({ ...form, org_id: orgId, total_collections: undefined })
      .select().single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave(data as ReceptionistRow); 
  }

  const iCls = "w-full bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8843a] transition-colors";

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#2e2016] shrink-0">
        <h2 className="font-bold text-white text-lg">New Daily Receptionist Record</h2>
        <p className="text-xs text-[#c4b49a]/50 mt-0.5">Submit at end of each day. Count only completed visits.</p>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-5">
        {/* GENERAL */}
        <SectionBanner title="General — Submission Details" description="Enter the date this report covers and confirm your name." />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50 mb-1">
              Submitted By<span className="text-[#c8843a] ml-0.5">*</span>
              <Tip field="submitted_by" />
            </label>
            <input value={s('submitted_by')} onChange={e => set('submitted_by', e.target.value)} placeholder="Your name" className={iCls} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/50 mb-1 block">
              Date<span className="text-[#c8843a] ml-0.5">*</span>
            </label>
            <input type="date" value={s('date')} onChange={e => set('date', e.target.value)} className={iCls} />
          </div>
        </div>

        {/* PREVENTIVE CARE */}
        <SectionBanner title="Preventive Care Visits" description="Enter the total number of completed preventive care visits for today. Count only visits that were fully completed. Hover ? for descriptions." />
        <div className="grid grid-cols-3 gap-3">
          <NInput label="Annual Wellness Visit (AWV)" field="awv" value={n('awv')} onChange={v => set('awv', v)} />
          <NInput label="Comprehensive Physical Exam (CPE)" field="cpe" value={n('cpe')} onChange={v => set('cpe', v)} />
          <NInput label="New CPE" field="new_cpe" value={n('new_cpe')} onChange={v => set('new_cpe', v)} />
          <NInput label="Well Child Check (WCC)" field="wcc" value={n('wcc')} onChange={v => set('wcc', v)} />
          <NInput label="Well Woman Exam (WWE)" field="wwe" value={n('wwe')} onChange={v => set('wwe', v)} />
          <NInput label="Immigration Physical (IP)" field="immigration_physical" value={n('immigration_physical')} onChange={v => set('immigration_physical', v)} />
        </div>

        {/* PROBLEM-BASED CARE */}
        <SectionBanner title="Problem-Based Care Visits" description="Include all sick visits, follow-ups, new patient visits, nurse visits, CCM, and telehealth." />
        <div className="grid grid-cols-3 gap-3">
          <NInput label="New Patients" field="new_patients" value={n('new_patients')} onChange={v => set('new_patients', v)} />
          <NInput label="Follow-Up Visits" field="follow_up_visits" value={n('follow_up_visits')} onChange={v => set('follow_up_visits', v)} />
          <NInput label="Sick Visits" field="sick_visits" value={n('sick_visits')} onChange={v => set('sick_visits', v)} />
          <NInput label="Nurse Visits" field="nurse_visits" value={n('nurse_visits')} onChange={v => set('nurse_visits', v)} />
          <NInput label="Chronic Care Management (CCM)" field="ccm" value={n('ccm')} onChange={v => set('ccm', v)} />
          <NInput label="Telehealth / Telemedicine" field="telehealth_visits" value={n('telehealth_visits')} onChange={v => set('telehealth_visits', v)} />
        </div>

        {/* WELLNESS */}
        <SectionBanner title="Wellness & Optimization Visits" description="Enter the total number of completed wellness and optimization visits for today." />
        <div className="grid grid-cols-3 gap-3">
          <NInput label="Wellness Evaluation" field="wellness_evaluation" value={n('wellness_evaluation')} onChange={v => set('wellness_evaluation', v)} />
          <NInput label="Wellness Follow-Up" field="wellness_follow_up" value={n('wellness_follow_up')} onChange={v => set('wellness_follow_up', v)} />
          <NInput label="Wellness Shots" field="wellness_shots" value={n('wellness_shots')} onChange={v => set('wellness_shots', v)} />
        </div>

        {/* PROCEDURES */}
        <SectionBanner title="Procedures Performed Today" description="Enter the total number of completed procedures for today." />
        <div className="grid grid-cols-2 gap-3">
          <NInput label="IV Therapy" field="iv_therapy" value={n('iv_therapy')} onChange={v => set('iv_therapy', v)} />
          <NInput label="Pellet Insertion (PI)" field="pellet_insertion" value={n('pellet_insertion')} onChange={v => set('pellet_insertion', v)} />
          <NInput label="Joint Injection (JI)" field="joint_injection" value={n('joint_injection')} onChange={v => set('joint_injection', v)} />
          <NInput label="Home / Mobile Visits" field="home_mobile_visits" value={n('home_mobile_visits')} onChange={v => set('home_mobile_visits', v)} />
        </div>

        {/* OPERATIONS */}
        <SectionBanner title="Operational Activity" description="Enter counts for operational activity today. Enter 0 if none." />
        <div className="grid grid-cols-3 gap-3">
          <NInput label="Total Patient Encounters" field="total_patient_encounters" value={n('total_patient_encounters')} onChange={v => set('total_patient_encounters', v)} />
          <NInput label="Same-Day Add-Ons" field="same_day_addons" value={n('same_day_addons')} onChange={v => set('same_day_addons', v)} />
          <NInput label="No-Shows" field="no_shows" value={n('no_shows')} onChange={v => set('no_shows', v)} />
          <NInput label="Reschedules" field="reschedules" value={n('reschedules')} onChange={v => set('reschedules', v)} />
          <NInput label="Non-Billable Phone Calls" field="non_billable_phone_calls" value={n('non_billable_phone_calls')} onChange={v => set('non_billable_phone_calls', v)} />
          <NInput label="Referrals" field="referrals" value={n('referrals')} onChange={v => set('referrals', v)} />
        </div>

        {/* COLLECTIONS */}
        <SectionBanner title="Collections by Payment Type" description="Enter the total amount collected today by payment type. Amounts must match the end-of-day report. Enter 0 if none collected in a category." />
        <div className="grid grid-cols-3 gap-3">
          <CInput label="Cash Collected" field="cash_collected" value={n('cash_collected')} onChange={v => set('cash_collected', v)} />
          <CInput label="Credit Card Collected" field="credit_card_collected" value={n('credit_card_collected')} onChange={v => set('credit_card_collected', v)} />
          <CInput label="Check Collected" field="check_collected" value={n('check_collected')} onChange={v => set('check_collected', v)} />
        </div>
        <div className="bg-[#2a1e10]/60 border border-[#3a2a1a] rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-[#c4b49a]">Total Collections (auto-calculated)</span>
          <span className="text-lg font-bold text-[#c8843a]">${total.toFixed(2)}</span>
        </div>

        {/* CONFIRMATION */}
        <div className="bg-[#1e2a1a] border border-[#2a4a2a] rounded-lg px-4 py-3">
          <p className="text-xs text-[#90c090]">
            ✓ Before submitting, confirm all visit counts are accurate and all number fields are completed. Enter 0 if none occurred — do not leave fields blank.
          </p>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-2">{error}</div>}
      </div>

      {/* Footer */}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReceptionistTrackerPage() {
  const { orgId, employeeName, isLoading: authLoading } = useOrgUser();
  const { resolveName } = useEmployeeNames(orgId);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [localRows, setLocalRows]   = useState<ReceptionistRow[]>(DEMO_ROWS);
  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReceptionistRow | null>(null);
  const [page, setPage]             = useState(1);
  const rowsPerPage                 = 25;

  // Fetch from Supabase
  const { data: dbRows, isLoading } = useQuery({
    queryKey: ['receptionist_tracker', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('receptionist_tracker')
        .select('*')
        .eq('org_id', orgId)
        .order('date', { ascending: false });
      return (data ?? []) as ReceptionistRow[];
    },
  });

  useEffect(() => {
    if (dbRows && dbRows.length > 0) setLocalRows(dbRows);
  }, [dbRows]);

  const filtered = localRows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(r).some(v => String(v).toLowerCase().includes(q));
  });

  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  // Totals row
  const totals = filtered.reduce((acc, r) => {
    COLUMNS.forEach(c => {
      if (c.key !== 'submitted_by' && c.key !== 'date') {
        acc[c.key] = (acc[c.key] || 0) + (Number((r as Record<string, unknown>)[c.key]) || 0);
      }
    });
    return acc;
  }, {} as Record<string, number>);

  function renderCell(col: typeof COLUMNS[0], row: ReceptionistRow) {
    const v = (row as Record<string, unknown>)[col.key];
    if (col.key === 'submitted_by') {
      const name = String(v || '—');
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#5c3d1e] text-[#e8c07a] border border-[#7a5230]">
          {name}
        </span>
      );
    }
    if (col.key === 'date') return <span className="text-[#c4b49a]">{v ? new Date(String(v)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>;
    if (CURRENCY_FIELDS.has(col.key)) return <span className="text-[#c4b49a] tabular-nums">${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
    if (PERCENT_FIELDS.has(col.key)) return <span className="text-[#c8843a] font-semibold tabular-nums">{v != null && Number(v) > 0 ? `${Number(v).toFixed(1)}%` : <span className="text-[#6b5a47]">N/A</span>}</span>;
    return <span className="text-[#c4b49a] tabular-nums">{String(v ?? 0)}</span>;
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1410] text-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-2 shrink-0 flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6b5a47]">Financial Tracker › Daily Receptionist Tracker</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">Daily Receptionist Tracker</h1>
          <p className="text-xs text-[#c4b49a]/50 mt-0.5">Table 1B — Submit at end of each clinical day</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#c8843a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#d4944a] transition-colors">
          <Plus className="w-4 h-4" />+ New Record
        </button>
      </div>

      {/* Summary stats */}
      <div className="px-6 pb-3 shrink-0 grid grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: filtered.length },
          { label: 'Total Collections', value: `$${(totals.total_collections || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
          { label: 'Total Referrals', value: totals.referrals || 0 },
          { label: 'Total Encounters', value: totals.total_patient_encounters || 0 },
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
                      {col.label}<Tip field={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 1} className="text-center py-12 text-[#6b5a47] text-sm">No records yet. Create the first one.</td></tr>
              ) : paginated.map(row => (
                <tr key={row.id}
                  onClick={() => setSelectedRow(row)}
                  className="border-b border-[#2e2016]/50 hover:bg-[#221710] cursor-pointer transition-colors">
                  <td className="px-2 py-2"><input type="checkbox" className="w-3.5 h-3.5 rounded border-[#3a2a1a] bg-[#1a1410]" onClick={e => e.stopPropagation()} /></td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap text-sm">{renderCell(col, row)}</td>
                  ))}
                </tr>
              ))}
              {/* Totals row */}
              {paginated.length > 0 && (
                <tr className="border-t-2 border-[#c8843a]/30 bg-[#221710]">
                  <td className="px-2 py-2" />
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2 text-sm font-semibold tabular-nums">
                      {col.key === 'submitted_by' ? <span className="text-[#a08060] text-xs uppercase tracking-wider">TOTALS</span>
                        : col.key === 'date' ? null
                        : CURRENCY_FIELDS.has(col.key) ? <span className="text-[#c8843a]">${(totals[col.key] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        : PERCENT_FIELDS.has(col.key) ? null
                        : <span className="text-[#c4b49a]">{totals[col.key] || 0}</span>}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[#c4b49a]/50">
            <span>Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} records</span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-[#c8843a] text-white' : 'bg-[#2e2016] text-[#c4b49a] hover:bg-[#3a2a1a]'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-3xl bg-[#1e1409] border border-[#3a2a1a] rounded-xl shadow-2xl">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-[#6b5a47] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>
            <NewReceptionistForm
              defaultSubmittedBy={employeeName || 'Receptionist'}
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
              <h2 className="font-bold text-white text-lg">Record Details</h2>
              <button onClick={() => setSelectedRow(null)} className="text-[#6b5a47] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {COLUMNS.map(col => {
                const v = (selectedRow as Record<string, unknown>)[col.key];
                return (
                  <div key={col.key} className="flex justify-between text-sm py-1.5 border-b border-[#2e2016]/50">
                    <span className="text-[#c4b49a]/60 text-xs uppercase tracking-wide">{col.label}</span>
                    <span className="text-white font-medium text-right">{renderCell(col, selectedRow)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}