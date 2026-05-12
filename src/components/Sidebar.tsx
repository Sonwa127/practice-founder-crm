'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useOrgUser } from '@/lib/useOrgUser'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, LayoutDashboard, TrendingUp,
  CheckSquare, MessageSquare, Building2, CreditCard, Settings,
  ChevronDown, ChevronUp, LogOut,
} from 'lucide-react'

interface NavItem { label: string; href: string; roles: string[] }
interface NavSection { title: string; icon: React.ElementType; items: NavItem[] }

const NAV: NavSection[] = [
  {
    title: 'Overview', icon: LayoutDashboard,
    items: [
      { label: 'KPI Dashboard', href: '/dashboard', roles: ['pf_admin', 'pf_team', 'client_owner'] },
    ],
  },
  {
    title: 'Financial Tracker', icon: TrendingUp,
    items: [
      { label: 'Weekly Financial Report',    href: '/dashboard/financials',           roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Daily Receptionist Tracker', href: '/dashboard/receptionist-tracker', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Daily Physician Tracker',    href: '/dashboard/physician-tracker',    roles: ['pf_admin', 'pf_team', 'client_owner'] },
      { label: 'Membership Tracker',         href: '/dashboard/membership-tracker',   roles: ['pf_admin', 'pf_team', 'client_owner'] },
    ],
  },
  {
    title: 'Task Management', icon: CheckSquare,
    items: [
      { label: 'Tasks',        href: '/dashboard/tasks',        roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Deliverables', href: '/dashboard/deliverables', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
    ],
  },
  {
    title: 'Huddle + Issues', icon: MessageSquare,
    items: [
      { label: 'Daily Huddle Log',    href: '/dashboard/huddle', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Issues & Breakdowns', href: '/dashboard/issues', roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
    ],
  },
  {
    title: 'Business HQ', icon: Building2,
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
    title: 'Billing Activities', icon: CreditCard,
    items: [
      { label: 'Daily Billing & Claims',    href: '/dashboard/billing',                roles: ['pf_admin', 'pf_team', 'client_owner', 'client_staff'] },
      { label: 'Charge Lag (Internal)',     href: '/dashboard/billing/charge-lag',     roles: ['pf_admin', 'pf_team'] },
      { label: 'AR Report (Internal)',      href: '/dashboard/billing/ar-report',      roles: ['pf_admin', 'pf_team'] },
      { label: 'Claims Summary (Internal)', href: '/dashboard/billing/claims-summary', roles: ['pf_admin', 'pf_team'] },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

function NavContent({
  role, employeeName, orgName, isLoading, pathname, onNavigate, collapsed,
}: {
  role: string | null
  employeeName: string | null
  orgName: string | null
  isLoading: boolean
  pathname: string
  onNavigate: () => void
  collapsed: boolean
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Overview': true,
    'Financial Tracker': true,
    'Task Management': true,
    'Huddle + Issues': true,
    'Business HQ': false,
    'Billing Activities': false,
  })

  const toggle = (title: string) => setOpenSections(p => ({ ...p, [title]: !p[title] }))

  const router = useRouter()
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleSections = NAV.map(s => ({
    ...s,
    items: s.items.filter(i => !role || i.roles.includes(role)),
  })).filter(s => s.items.length > 0)

  return (
    <nav className="flex flex-col h-full">

      {/* Brand */}
      <div className={`border-b border-[#2e2016] shrink-0 flex items-center gap-2 ${collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4'}`}>
        <div className="w-7 h-7 rounded-lg bg-[#c8843a]/20 flex items-center justify-center shrink-0">
          <span className="text-[#c8843a] font-bold text-sm">P</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[#c8843a] font-bold text-sm leading-tight truncate">Practice Founder</div>
            <div className="text-[#c4b49a]/50 text-[10px] truncate">
              {isLoading ? '…' : (orgName ?? 'CRM')}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {visibleSections.map(section => {
          const Icon = section.icon
          const isOpen = openSections[section.title] ?? true
          const hasActive = section.items.some(i => isActive(pathname, i.href))

          if (collapsed) {
            return (
              <div key={section.title} className="relative group px-2 py-0.5">
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg mx-auto cursor-pointer transition-colors ${
                  hasActive ? 'bg-[#c8843a]/15 text-[#c8843a]' : 'text-[#c4b49a]/40 hover:text-[#c4b49a] hover:bg-[#2e2016]'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="absolute left-full top-0 ml-1 z-50 hidden group-hover:block">
                  <div className="bg-[#1e1409] border border-[#3a2a1a] rounded-xl px-3 py-2 min-w-[180px] shadow-2xl">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#c4b49a]/40 mb-1.5">{section.title}</div>
                    {section.items.map(item => (
                      <Link key={item.label} href={item.href} onClick={onNavigate}
                        className={`block py-1.5 px-2 rounded-lg text-xs transition-colors ${
                          isActive(pathname, item.href)
                            ? 'text-[#c8843a] font-medium bg-[#c8843a]/10'
                            : 'text-[#c4b49a] hover:text-white hover:bg-[#2e2016]'
                        }`}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={section.title} className="mb-0.5">
              <button onClick={() => toggle(section.title)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[#c4b49a]/40 hover:text-[#c4b49a]/70 transition-colors group">
                <Icon className="w-3.5 h-3.5 shrink-0 group-hover:text-[#c8843a]/60 transition-colors" />
                <span className="text-[10px] font-semibold uppercase tracking-widest flex-1 text-left">{section.title}</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {isOpen && (
                <div className="space-y-0.5 px-2 pb-1">
                  {section.items.map(item => (
                    <Link key={item.label} href={item.href} onClick={onNavigate}
                      className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive(pathname, item.href)
                          ? 'bg-[#c8843a]/15 text-[#c8843a] font-medium'
                          : 'text-[#c4b49a] hover:bg-[#2e2016] hover:text-white'
                      }`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Settings */}
        <div className={`mt-1 pt-2 border-t border-[#2e2016] ${collapsed ? 'px-2' : 'px-2'}`}>
          {collapsed ? (
            <div className="relative group">
              <Link href="/dashboard/settings" onClick={onNavigate}
                className={`flex items-center justify-center w-9 h-9 rounded-lg mx-auto transition-colors ${
                  isActive(pathname, '/dashboard/settings')
                    ? 'bg-[#c8843a]/15 text-[#c8843a]'
                    : 'text-[#c4b49a]/40 hover:text-[#c4b49a] hover:bg-[#2e2016]'
                }`}>
                <Settings className="w-4 h-4" />
              </Link>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 z-50 hidden group-hover:block">
                <div className="bg-[#1e1409] border border-[#3a2a1a] rounded-lg px-3 py-1.5 shadow-2xl">
                  <span className="text-xs text-[#c4b49a]">Settings</span>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/dashboard/settings" onClick={onNavigate}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(pathname, '/dashboard/settings')
                  ? 'bg-[#c8843a]/15 text-[#c8843a] font-medium'
                  : 'text-[#c4b49a] hover:bg-[#2e2016] hover:text-white'
              }`}>
              <Settings className="w-3.5 h-3.5" />Settings
            </Link>
          )}
        </div>
      </div>

      {/* User footer */}
      <div className={`border-t border-[#2e2016] shrink-0 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
        {isLoading ? (
          <div className="h-7 w-full rounded bg-[#2e2016] animate-pulse" />
        ) : collapsed ? (
          <div className="relative group flex justify-center">
            <div className="w-8 h-8 rounded-full bg-[#c8843a]/20 flex items-center justify-center text-[#c8843a] text-xs font-semibold cursor-default">
              {employeeName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="absolute left-full bottom-0 ml-1 z-50 hidden group-hover:block">
              <div className="bg-[#1e1409] border border-[#3a2a1a] rounded-xl px-3 py-2 shadow-2xl min-w-max">
                <div className="text-xs text-white font-medium">{employeeName ?? 'Unknown'}</div>
                <div className="text-[10px] text-[#c4b49a]/50 capitalize mt-0.5">{role ?? 'staff'}</div>
                <button
                  onClick={handleSignOut}
                  className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400/70 hover:text-red-400 transition-colors w-full"
                >
                  <LogOut className="w-3 h-3" />Sign out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#c8843a]/20 flex items-center justify-center text-[#c8843a] text-xs font-semibold shrink-0">
              {employeeName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-medium truncate">{employeeName ?? 'Unknown'}</div>
              <div className="text-[#c4b49a]/50 text-[10px] capitalize">{role ?? 'staff'}</div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#c4b49a]/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { role, employeeName, orgName, isLoading } = useOrgUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const navProps = { role, employeeName, orgName, isLoading, pathname, onNavigate: () => setMobileOpen(false), collapsed }

  return (
    <>
      {/* Desktop */}
      <aside className={`hidden lg:flex flex-col shrink-0 bg-[#150f0a] border-r border-[#2e2016] h-screen relative transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        <NavContent {...navProps} />
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#2e2016] border border-[#3a2a1a] flex items-center justify-center text-[#c4b49a] hover:text-[#c8843a] hover:border-[#c8843a]/50 transition-colors z-10 shadow-lg"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-lg bg-[#1e1810] border border-[#2e2016] flex items-center justify-center text-[#c8843a]"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '×' : '☰'}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#150f0a] border-r border-[#2e2016] flex flex-col">
            <NavContent {...navProps} collapsed={false} />
          </aside>
        </>
      )}
    </>
  )
}