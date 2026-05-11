'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrgUser } from '@/lib/useOrgUser'
import { useEmployeeNames } from '@/lib/useEmployeeNames'
import RoleGuard from '@/components/RoleGuard'
import RecordComments from '@/components/RecordComments'

interface TrackerRecord {
  id: string
  submitted_by: string | null
  date: string
  awv: number; cpe: number; new_cpe: number; well_woman_check: number
  well_woman_exam: number; immigration_physical: number
  new_patients: number; follow_ups: number; sick_visits: number
  nurse_visits: number; ccm: number; telehealth: number
  wellness_eval: number; wellness_followup: number; wellness_shots: number
  iv_therapy: number; pellet_insertion: number; joint_injection: number
  home_mobile_visits: number; total_patient_encounters: number
  same_day_addons: number; no_shows: number; reschedules: number
  non_billable_calls: number; referrals: number
  cash_collected: number; credit_card_collected: number; check_collected: number
  total_collections: number
  created_at: string
}

const ZERO_FORM = {
  date: new Date().toISOString().split('T')[0],
  awv: '', cpe: '', new_cpe: '', well_woman_check: '', well_woman_exam: '',
  immigration_physical: '', new_patients: '', follow_ups: '', sick_visits: '',
  nurse_visits: '', ccm: '', telehealth: '', wellness_eval: '', wellness_followup: '',
  wellness_shots: '', iv_therapy: '', pellet_insertion: '', joint_injection: '',
  home_mobile_visits: '', total_patient_encounters: '', same_day_addons: '',
  no_shows: '', reschedules: '', non_billable_calls: '', referrals: '',
  cash_collected: '', credit_card_collected: '', check_collected: '',
}

type FormData = typeof ZERO_FORM

// Tooltip component
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button type="button"
        className="w-4 h-4 rounded-full border border-[#c8843a]/40 text-[#c8843a] text-[10px] leading-none hover:bg-[#c8843a]/10"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      >?</button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[#1a1410] border border-[#c8843a]/30 rounded-lg p-3 text-xs text-[#c4b49a] shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}

function SectionBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#c8843a]/10 border border-[#c8843a]/20 rounded-lg px-4 py-3 mb-3">
      <div className="text-[#c8843a] font-semibold text-sm">{title}</div>
      <div className="text-[#c4b49a]/70 text-xs mt-0.5">{description}</div>
    </div>
  )
}

const inputClass = "bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-[#c8843a]"

function NumField({ label, tooltip, fieldKey, form, setForm }:
  { label: string; tooltip: string; fieldKey: keyof FormData; form: FormData; setForm: (f: FormData) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#c4b49a] font-medium">
        {label} <span className="text-red-400">*</span>
        <Tip text={tooltip} />
      </label>
      <input
        type="number" min="0" step="1"
        value={form[fieldKey] as string}
        onChange={e => setForm({ ...form, [fieldKey]: e.target.value })}
        className={inputClass}
        placeholder="0"
      />
    </div>
  )
}

function DailyReceptionistInner() {
  const { orgId, employeeId, isLoading: userLoading } = useOrgUser()
  const { resolveName } = useEmployeeNames(orgId)
  const [records, setRecords] = useState<TrackerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(ZERO_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const supabase = createClient()

  async function loadRecords() {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('daily_receptionist_tracker')
      .select('*')
      .eq('practice_id', orgId)
      .order('date', { ascending: false })
      .limit(30)
    setRecords((data as TrackerRecord[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRecords() }, [orgId])

  const totalCollections =
    (parseFloat(form.cash_collected) || 0) +
    (parseFloat(form.credit_card_collected) || 0) +
    (parseFloat(form.check_collected) || 0)

  function openNew() {
    setForm(ZERO_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(r: TrackerRecord) {
    setForm({
      date: r.date,
      awv: String(r.awv ?? 0), cpe: String(r.cpe ?? 0), new_cpe: String(r.new_cpe ?? 0),
      well_woman_check: String(r.well_woman_check ?? 0), well_woman_exam: String(r.well_woman_exam ?? 0),
      immigration_physical: String(r.immigration_physical ?? 0),
      new_patients: String(r.new_patients ?? 0), follow_ups: String(r.follow_ups ?? 0),
      sick_visits: String(r.sick_visits ?? 0), nurse_visits: String(r.nurse_visits ?? 0),
      ccm: String(r.ccm ?? 0), telehealth: String(r.telehealth ?? 0),
      wellness_eval: String(r.wellness_eval ?? 0), wellness_followup: String(r.wellness_followup ?? 0),
      wellness_shots: String(r.wellness_shots ?? 0), iv_therapy: String(r.iv_therapy ?? 0),
      pellet_insertion: String(r.pellet_insertion ?? 0), joint_injection: String(r.joint_injection ?? 0),
      home_mobile_visits: String(r.home_mobile_visits ?? 0),
      total_patient_encounters: String(r.total_patient_encounters ?? 0),
      same_day_addons: String(r.same_day_addons ?? 0), no_shows: String(r.no_shows ?? 0),
      reschedules: String(r.reschedules ?? 0), non_billable_calls: String(r.non_billable_calls ?? 0),
      referrals: String(r.referrals ?? 0),
      cash_collected: String(r.cash_collected ?? 0),
      credit_card_collected: String(r.credit_card_collected ?? 0),
      check_collected: String(r.check_collected ?? 0),
    })
    setEditId(r.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !employeeId) return
    setSaving(true)
    const toNum = (v: string) => parseInt(v) || 0
    const toCurrency = (v: string) => parseFloat(v) || 0
    const payload = {
      practice_id: orgId,
      submitted_by: employeeId,
      date: form.date,
      awv: toNum(form.awv), cpe: toNum(form.cpe), new_cpe: toNum(form.new_cpe),
      well_woman_check: toNum(form.well_woman_check), well_woman_exam: toNum(form.well_woman_exam),
      immigration_physical: toNum(form.immigration_physical),
      new_patients: toNum(form.new_patients), follow_ups: toNum(form.follow_ups),
      sick_visits: toNum(form.sick_visits), nurse_visits: toNum(form.nurse_visits),
      ccm: toNum(form.ccm), telehealth: toNum(form.telehealth),
      wellness_eval: toNum(form.wellness_eval), wellness_followup: toNum(form.wellness_followup),
      wellness_shots: toNum(form.wellness_shots), iv_therapy: toNum(form.iv_therapy),
      pellet_insertion: toNum(form.pellet_insertion), joint_injection: toNum(form.joint_injection),
      home_mobile_visits: toNum(form.home_mobile_visits),
      total_patient_encounters: toNum(form.total_patient_encounters),
      same_day_addons: toNum(form.same_day_addons), no_shows: toNum(form.no_shows),
      reschedules: toNum(form.reschedules), non_billable_calls: toNum(form.non_billable_calls),
      referrals: toNum(form.referrals),
      cash_collected: toCurrency(form.cash_collected),
      credit_card_collected: toCurrency(form.credit_card_collected),
      check_collected: toCurrency(form.check_collected),
    }
    if (editId) {
      await supabase.from('daily_receptionist_tracker').update(payload).eq('id', editId)
    } else {
      await supabase.from('daily_receptionist_tracker').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadRecords()
  }

  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} record(s)?`)) return
    await supabase.from('daily_receptionist_tracker').delete().in('id', Array.from(selected))
    setSelected(new Set())
    loadRecords()
  }

  if (userLoading || loading) return <div className="p-8 text-[#c4b49a] animate-pulse">Loading…</div>

  return (
    <div className="min-h-screen bg-[#1a1410] text-[#c4b49a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Daily Receptionist Tracker</h1>
            <p className="text-[#c4b49a]/60 text-xs mt-0.5">Submit at end of each day. Count only completed visits.</p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <button onClick={bulkDelete} className="text-xs text-red-400 border border-red-800/40 rounded px-3 py-1.5 hover:bg-red-950/30">
                Delete {selected.size}
              </button>
            )}
            <button onClick={openNew} className="bg-[#c8843a] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#b8732a]">
              + New Entry
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-[#c8843a]/30 rounded-xl bg-[#1e1810] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">{editId ? 'Edit Entry' : 'Daily Receptionist Tracker'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#c4b49a]/60 hover:text-white text-xl">×</button>
            </div>
            <p className="text-[#c4b49a]/60 text-xs mb-4 italic">
              Submit this form at the end of each day. Count only completed visits — not scheduled, rescheduled, or no-show appointments. Hover the ? icon next to any service name to see what it means.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* GENERAL */}
              <SectionBanner title="GENERAL — Submission Details" description="Enter the date this report covers." />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} required />
                </div>
              </div>

              {/* PREVENTIVE CARE */}
              <SectionBanner title="PREVENTIVE CARE — Preventive Care Visits"
                description="Enter the total number of completed preventive care visits for today. Count only visits that were fully completed. Hover the ? icon for descriptions. Enter 0 if none." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Annual Wellness Visit (AWV)" fieldKey="awv" form={form} setForm={setForm}
                  tooltip="A Medicare-covered preventive visit for patients 65+. Focuses on health risk assessment, personalized prevention plan, and vital screenings. Does NOT include a head-to-toe physical exam." />
                <NumField label="Comprehensive Physical Exam (CPE)" fieldKey="cpe" form={form} setForm={setForm}
                  tooltip="A full head-to-toe physical examination for an existing patient. Includes review of all body systems. Billed as a preventive visit for established patients." />
                <NumField label="New CPE" fieldKey="new_cpe" form={form} setForm={setForm}
                  tooltip="A comprehensive physical exam for a NEW patient to this practice. Same scope as CPE but billed at a higher rate for new patient first visits." />
                <NumField label="Well Woman Check (WWC)" fieldKey="well_woman_check" form={form} setForm={setForm}
                  tooltip="Preventive wellness visit for pediatric or younger female patients. Includes age-appropriate screenings and growth monitoring." />
                <NumField label="Well Woman Exam (WWE)" fieldKey="well_woman_exam" form={form} setForm={setForm}
                  tooltip="Annual gynecological wellness visit. Includes pelvic exam, breast exam, and any indicated cancer screenings such as Pap smear." />
                <NumField label="Immigration Physical (IP)" fieldKey="immigration_physical" form={form} setForm={setForm}
                  tooltip="A USCIS-required medical examination for immigration applicants. Follows specific federal protocols. Must be conducted by a USCIS-designated civil surgeon." />
              </div>

              {/* PROBLEM-BASED CARE */}
              <SectionBanner title="PROBLEM-BASED CARE — Problem-Based Care Visits"
                description="Enter the total number of completed problem-based visits for today. Include all sick visits, follow-ups, new patient visits, nurse visits, CCM, and telehealth." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="New Patients" fieldKey="new_patients" form={form} setForm={setForm}
                  tooltip="Patients visiting this practice for the very first time. Billed as a new patient evaluation." />
                <NumField label="Follow Ups" fieldKey="follow_ups" form={form} setForm={setForm}
                  tooltip="Established patients returning to follow up on a previously addressed condition, lab result, or treatment plan." />
                <NumField label="Sick Visits" fieldKey="sick_visits" form={form} setForm={setForm}
                  tooltip="Unscheduled or same-day visits for acute illness or injury. Count only visits that were completed today." />
                <NumField label="Nurse Visits" fieldKey="nurse_visits" form={form} setForm={setForm}
                  tooltip="Visits managed and completed by nursing staff without direct physician involvement — e.g. vaccine administration, wound care, blood draw." />
                <NumField label="Chronic Care Management (CCM)" fieldKey="ccm" form={form} setForm={setForm}
                  tooltip="A Medicare program for patients with two or more chronic conditions. Monthly coordination and care plan management. Does not require an in-person visit." />
                <NumField label="Telehealth Visits" fieldKey="telehealth" form={form} setForm={setForm}
                  tooltip="Video or phone-based visits conducted remotely. Count only completed telehealth encounters, not scheduled ones." />
              </div>

              {/* WELLNESS */}
              <SectionBanner title="WELLNESS / OPTIMIZATION — Wellness & Optimization Visits"
                description="Enter the total number of completed wellness and optimization visits for today." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Wellness Evaluation" fieldKey="wellness_eval" form={form} setForm={setForm}
                  tooltip="An initial consultation for a patient beginning a wellness or optimization program. Includes health history review, goal setting, and program design." />
                <NumField label="Wellness Follow Up" fieldKey="wellness_followup" form={form} setForm={setForm}
                  tooltip="A follow-up for a patient already enrolled in a wellness program. Tracks progress and adjusts plan as needed." />
                <NumField label="Wellness Shot" fieldKey="wellness_shots" form={form} setForm={setForm}
                  tooltip="Administration of a wellness injection — e.g. vitamin B12, vitamin D, immune support. Count each administration as one visit." />
              </div>

              {/* PROCEDURES */}
              <SectionBanner title="PROCEDURES — Procedures Performed Today"
                description="Enter the total number of completed procedures for today." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="IV Therapy" fieldKey="iv_therapy" form={form} setForm={setForm}
                  tooltip="Administration of vitamins, minerals, or other nutrients directly into the bloodstream via IV line. Each session = one count." />
                <NumField label="Pellet Insertion (PI)" fieldKey="pellet_insertion" form={form} setForm={setForm}
                  tooltip="Subcutaneous implantation of hormone pellets for bioidentical hormone replacement therapy. Count each procedure performed today." />
                <NumField label="Joint Injection (JI)" fieldKey="joint_injection" form={form} setForm={setForm}
                  tooltip="Injection of corticosteroid, hyaluronic acid, or PRP into a joint for pain relief. Each injection = one count, regardless of joint." />
                <NumField label="Home / Mobile Visits" fieldKey="home_mobile_visits" form={form} setForm={setForm}
                  tooltip="Physician or clinical staff traveled to a patient's home or off-site location to deliver care. Count each visit made today." />
              </div>

              {/* OPERATIONS */}
              <SectionBanner title="OPERATIONS — Operational Activity"
                description="Enter counts for operational activity today." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Total Patient Encounters" fieldKey="total_patient_encounters" form={form} setForm={setForm}
                  tooltip="Total unique patients seen today across all visit types." />
                <NumField label="Same-Day Add-Ons" fieldKey="same_day_addons" form={form} setForm={setForm}
                  tooltip="Patients added to the schedule on the same day they were seen. These were not on yesterday's schedule." />
                <NumField label="No-Shows" fieldKey="no_shows" form={form} setForm={setForm}
                  tooltip="Patients who had a scheduled appointment but did not arrive and did not cancel in advance." />
                <NumField label="Reschedules" fieldKey="reschedules" form={form} setForm={setForm}
                  tooltip="Appointments moved to a future date today — whether by the patient or the practice." />
                <NumField label="Phone Calls — Non-Billable" fieldKey="non_billable_calls" form={form} setForm={setForm}
                  tooltip="Inbound or outbound phone calls completed today that cannot be billed to insurance." />
                <NumField label="Referrals" fieldKey="referrals" form={form} setForm={setForm}
                  tooltip="The number of referrals issued today by the provider. A referral is a formal recommendation for a patient to see a specialist or receive a specific service." />
              </div>

              {/* COLLECTIONS */}
              <SectionBanner title="COLLECTIONS — Collections by Payment Type"
                description="Enter the total amount collected today by payment type. Amounts must match the end-of-day report before submitting. Enter 0 if none were collected in a category." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Cash Collected ($) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" min="0" value={form.cash_collected} onChange={e => setForm({ ...form, cash_collected: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Credit Card Collected ($) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" min="0" value={form.credit_card_collected} onChange={e => setForm({ ...form, credit_card_collected: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c4b49a] font-medium">Check Collected ($) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" min="0" value={form.check_collected} onChange={e => setForm({ ...form, check_collected: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
              </div>
              <div className="bg-[#2e2016]/30 rounded-lg p-3">
                <span className="text-xs text-[#c4b49a]/50">Total Collections (auto): </span>
                <span className="text-white font-semibold">${totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Confirmation note */}
              <div className="bg-[#2e2016]/40 border border-[#2e2016] rounded-lg p-3 text-xs text-[#c4b49a]/70">
                Before submitting, confirm all visit counts are accurate and all number fields are completed. Enter 0 if none occurred — do not leave fields blank.
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="bg-[#c8843a] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#b8732a] disabled:opacity-50">
                  {saving ? 'Saving…' : editId ? 'Update' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border border-[#2e2016] text-[#c4b49a] rounded-lg px-5 py-2 text-sm hover:border-[#c8843a]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Records table */}
        {records.length === 0 && !showForm ? (
          <div className="text-center py-16 text-[#c4b49a]/40 text-sm">No entries yet.</div>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="border border-[#2e2016] rounded-xl bg-[#1e1810] overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#2e2016]/20"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => {
                    const s = new Set(selected); s.has(r.id) ? s.delete(r.id) : s.add(r.id); setSelected(s)
                  }} onClick={e => e.stopPropagation()} className="accent-[#c8843a] shrink-0" />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="text-white font-medium">{r.date}</div>
                      <div className="text-[#c4b49a]/60 text-xs">{resolveName(r.submitted_by)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Encounters</div>
                      <div className="text-white">{r.total_patient_encounters}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">Collections</div>
                      <div className="text-white">${r.total_collections?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#c4b49a]/50">No-shows / Referrals</div>
                      <div className="text-white">{r.no_shows} / {r.referrals}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(r) }} className="text-xs text-[#c8843a] hover:underline">Edit</button>
                    <span className="text-[#c4b49a]/40 text-xs">{expandedId === r.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expandedId === r.id && (
                  <div className="border-t border-[#2e2016] p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {([
                        ['AWV', r.awv], ['CPE', r.cpe], ['New CPE', r.new_cpe],
                        ['Well Woman Check', r.well_woman_check], ['Well Woman Exam', r.well_woman_exam],
                        ['Immigration Physical', r.immigration_physical],
                        ['New Patients', r.new_patients], ['Follow Ups', r.follow_ups],
                        ['Sick Visits', r.sick_visits], ['Nurse Visits', r.nurse_visits],
                        ['CCM', r.ccm], ['Telehealth', r.telehealth],
                        ['Wellness Eval', r.wellness_eval], ['Wellness Follow-Up', r.wellness_followup],
                        ['Wellness Shots', r.wellness_shots],
                        ['IV Therapy', r.iv_therapy], ['Pellet Insertion', r.pellet_insertion],
                        ['Joint Injection', r.joint_injection], ['Home/Mobile', r.home_mobile_visits],
                        ['Same-Day Add-Ons', r.same_day_addons], ['No-Shows', r.no_shows],
                        ['Reschedules', r.reschedules], ['Non-Billable Calls', r.non_billable_calls],
                        ['Referrals', r.referrals],
                      ] as [string, number][]).map(([label, val]) => (
                        <div key={label}>
                          <div className="text-[#c4b49a]/50 text-xs">{label}</div>
                          <div className="text-white">{val ?? 0}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#2e2016] text-sm">
                      <div><div className="text-[#c4b49a]/50 text-xs">Cash</div><div className="text-white">${r.cash_collected?.toFixed(2)}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Card</div><div className="text-white">${r.credit_card_collected?.toFixed(2)}</div></div>
                      <div><div className="text-[#c4b49a]/50 text-xs">Check</div><div className="text-white">${r.check_collected?.toFixed(2)}</div></div>
                    </div>
                    <RecordComments recordId={r.id} tableName="daily_receptionist_tracker" orgId={orgId!} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DailyReceptionistPage() {
  return (
    <RoleGuard allow={['pf_admin', 'pf_team', 'client_owner', 'client_staff']}>
      <DailyReceptionistInner />
    </RoleGuard>
  )
}