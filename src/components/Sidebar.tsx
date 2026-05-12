'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrgUser } from '@/lib/useOrgUser'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  roles: string[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'KPI Dashboard', href: '/dashboard', roles: ['pf_admin', 'pf_team', 'client_owner'] },
    ],
  },
  {
    title: 'Financial Tracker',
    items: [
      { label: 'Weekly Financial Report',    href: '/dashboard/financials',                      roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Daily Receptionist Tracker', href: '/dashboard/daily-tracker?view=receptionist', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Daily Physician Tracker',    href: '/dashboard/daily-tracker?view=physician',    roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Membership Tracker',         href: '/dashboard/membership-tracker',              roles: ['pf_admin', 'pf_team', 'client_owner'] },
    ],
  },
  {
    title: 'Task Management',
    items: [
      { label: 'Tasks',        href: '/dashboard/tasks',        roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Deliverables', href: '/dashboard/deliverables', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
    ],
  },
  {
    title: 'Huddle + Issues',
    items: [
      { label: 'Daily Huddle Log',    href: '/dashboard/huddle', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Issues & Breakdowns', href: '/dashboard/issues', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
    ],
  },
  {
    title: 'Business HQ',
    items: [
      { label: 'Core Functions',   href: '/dashboard/business-hq/core-functions', roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Systems',          href: '/dashboard/business-hq/systems',        roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Processes',        href: '/dashboard/business-hq/processes',      roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'SOPs',             href: '/dashboard/business-hq/sops',           roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Roles',            href: '/dashboard/business-hq/roles',          roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Employees',        href: '/dashboard/business-hq/employees',      roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Services',         href: '/dashboard/business-hq/services',       roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Membership Plans', href: '/dashboard/membership',                 roles: ['pf_admin', 'pf_team', 'client_owner'] },
    ],
  },
  {
    title: 'Billing Activities',
    items: [
      { label: 'Daily Billing & Claims',    href: '/dashboard/billing',                roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Charge Lag (Internal)',     href: '/dashboard/billing/charge-lag',     roles: ['pf_admin', 'pf_team'] },
      { label: 'AR Report (Internal)',      href: '/dashboard/billing/ar-report',      roles: ['pf_admin', 'pf_team'] },
      { label: 'Claims Summary (Internal)',  href: '/dashboard/billing/claims-summary', roles: ['pf_admin', 'pf_team'] },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  const [hrefPath, hrefQuery] = href.split('?')
  if (href === '/dashboard') return pathname === '/dashboard'
  if (hrefQuery) {
    const params = new URLSearchParams(hrefQuery)
    const currentParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    return pathname === hrefPath && params.get('view') === currentParams.get('view')
  }
  return pathname.startsWith(hrefPath)
}

function NavContent({
  role,
  employeeName,
  isLoading,
  pathname,
  onNavigate,
}: {
  role: string | null
  employeeName: string | null
  isLoading: boolean
  pathname: string
  onNavigate: () => void
}) {
  const visibleSections = NAV.map(section => ({
    ...section,
    items: section.items.filter(item => !role || item.roles.includes(role)),
  })).filter(s => s.items.length > 0)

  return (
    <nav className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-[#2e2016] shrink-0">
        <div className="text-[#c8843a] font-bold text-base leading-tight">Practice Founder</div>
        <div className="text-[#c4b49a]/50 text-xs mt-0.5">CRM</div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4 min-h-0">
        {visibleSections.map(section => (
          <div key={section.title}>
            <div className="text-[#c4b49a]/40 text-[10px] font-semibold uppercase tracking-widest px-2 mb-1">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? 'bg-[#c8843a]/15 text-[#c8843a] font-medium'
                      : 'text-[#c4b49a] hover:bg-[#2e2016] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#2e2016] px-5 py-4 shrink-0">
        {isLoading ? (
          <div className="h-7 w-24 rounded bg-[#2e2016] animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#c8843a]/20 flex items-center justify-center text-[#c8843a] text-xs font-semibold shrink-0">
              {employeeName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-medium truncate">{employeeName ?? 'Unknown'}</div>
              <div className="text-[#c4b49a]/50 text-[10px] capitalize">{role ?? 'staff'}</div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { role, employeeName, isLoading } = useOrgUser()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navProps = {
    role,
    employeeName,
    isLoading,
    pathname,
    onNavigate: () => setMobileOpen(false),
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[#150f0a] border-r border-[#2e2016] h-screen">
        <NavContent {...navProps} />
      </aside>

      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-lg bg-[#1e1810] border border-[#2e2016] flex items-center justify-center text-[#c8843a]"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '×' : '☰'}
      </button>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#150f0a] border-r border-[#2e2016] flex flex-col">
            <NavContent {...navProps} />
          </aside>
        </>
      )}
    </>
  )
}