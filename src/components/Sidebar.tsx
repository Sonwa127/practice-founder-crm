'use client';

// src/components/Sidebar.tsx
// Role-aware sidebar — nav items filtered by the logged-in user's role.
// Staff only see their own section. Owners/managers see everything.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ThemeContext'
import { useOrgUser } from '@/lib/useOrgUser'
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Activity,
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  MessageSquare,
  Lightbulb,
  Map,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { PracticeRole } from '@/components/RoleGuard'

// ─── Nav structure ────────────────────────────────────────────────────────────
// visibleTo: if omitted, item shows to ALL roles
// If provided, only listed roles can see it

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  visibleTo?: PracticeRole[]
}

interface NavSection {
  label: string | null
  visibleTo?: PracticeRole[]
  items: NavItem[]
}

const OWNER_AND_OPS: PracticeRole[] = ['dr_evans', 'operations_manager', 'practice_founder', 'practice_manager']
const OWNER_ONLY: PracticeRole[]    = ['dr_evans', 'practice_founder', 'practice_manager']

const NAV: NavSection[] = [
  {
    label: null,
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        visibleTo: OWNER_AND_OPS,   // ← RESTRICTED: owner + ops manager only
      },
    ],
  },
  {
    label: 'FINANCIAL TRACKER',
    items: [
      {
        href: '/dashboard/billing',
        label: 'Daily Billing & Claims',
        icon: FileText,
        visibleTo: ['billing_staff', 'dr_evans', 'operations_manager', 'practice_founder', 'practice_manager'],
      },
      {
        href: '/dashboard/financials',
        label: 'Weekly Financial Reports',
        icon: BarChart3,
        visibleTo: OWNER_AND_OPS,   // ← RESTRICTED: owner + ops manager only
      },
      {
        href: '/dashboard/daily-tracker',
        label: 'Daily Tracker',
        icon: Activity,
        // All roles can submit/view daily tracker
      },
    ],
  },
  {
    label: 'TASK MANAGEMENT',
    items: [
      { href: '/dashboard/projects',  label: 'Projects',            icon: FolderKanban },
      { href: '/dashboard/tasks',     label: 'Tasks',               icon: CheckSquare  },
      { href: '/dashboard/issues',    label: 'Issues & Breakdowns', icon: AlertTriangle },
      { href: '/dashboard/huddle',    label: 'Daily Huddle Log',    icon: MessageSquare },
      { href: '/dashboard/ideas',     label: 'Ideas',               icon: Lightbulb    },
    ],
  },
  {
    label: 'BUSINESS MAPPING',
    visibleTo: OWNER_ONLY,
    items: [
      { href: '/dashboard/business-mapping', label: 'Business Mapping HQ', icon: Map },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname           = usePathname()
  const { dark, toggleDark } = useTheme()
  const router             = useRouter()
  const { role, employeeName, isLoading } = useOrgUser()
  const supabase           = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (label: string) => {
    setCollapsed(p => ({ ...p, [label]: !p[label] }))
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Check if a nav item is visible to the current role
  const canSee = (visibleTo?: PracticeRole[]) => {
    if (!visibleTo) return true          // no restriction = everyone sees it
    if (!role) return false
    return visibleTo.includes(role as PracticeRole)
  }

  // Role display label for the identity pill
  const roleLabel: Record<string, string> = {
    dr_evans:           'Practice Owner',
    operations_manager: 'Operations Manager',
    receptionist:       'Receptionist',
    billing_staff:      'Billing Staff',
    practice_manager:   'Practice Manager',
    practice_founder:   'Practice Founder',
  }

  return (
    <aside className={`fixed top-0 left-0 h-screen w-64 flex flex-col z-40 border-r transition-colors
      ${dark
        ? 'bg-[#120d08] border-[#2e2016] text-white'
        : 'bg-amber-50 border-amber-200 text-gray-900'
      }`}>

      {/* Logo */}
      <div className={`px-5 py-5 border-b ${dark ? 'border-[#2e2016]' : 'border-amber-200'}`}>
        <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          Practice Founder
        </p>
        <p className={`text-xs mt-0.5 ${dark ? 'text-[#6b5a47]' : 'text-amber-700'}`}>
          Practice Management
        </p>
      </div>

      {/* Identity pill — shows who is logged in */}
      {!isLoading && employeeName && (
        <div className={`mx-3 mt-3 px-3 py-2 rounded-xl border ${dark ? 'bg-[#1e1409] border-[#2e2016]' : 'bg-amber-100 border-amber-200'}`}>
          <p className={`text-xs font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
            {employeeName}
          </p>
          <p className={`text-[10px] mt-0.5 ${dark ? 'text-[#6b5a47]' : 'text-amber-700'}`}>
            {roleLabel[role ?? ''] ?? 'Staff'}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 mt-2">
        {NAV.map((section, si) => {
          // Hide entire section if role-gated and user doesn't qualify
          if (!canSee(section.visibleTo)) return null

          // Filter individual items by role
          const visibleItems = section.items.filter(item => canSee(item.visibleTo))
          if (visibleItems.length === 0) return null

          return (
            <div key={si} className={section.label ? 'mt-4' : ''}>
              {/* Section header */}
              {section.label && (
                <button
                  onClick={() => toggleSection(section.label!)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 mb-1 text-[10px] font-semibold uppercase tracking-widest transition
                    ${dark ? 'text-[#c8843a] hover:text-[#e8a05a]' : 'text-amber-600 hover:text-amber-800'}`}
                >
                  {section.label}
                  {collapsed[section.label]
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />
                  }
                </button>
              )}

              {/* Nav items */}
              {!collapsed[section.label ?? ''] && visibleItems.map(item => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition
                      ${active
                        ? dark
                          ? 'bg-[#c8843a] text-white shadow-lg shadow-[#c8843a]/20'
                          : 'bg-amber-500 text-white shadow-md'
                        : dark
                          ? 'text-[#a08060] hover:bg-[#1e1409] hover:text-white'
                          : 'text-gray-600 hover:bg-amber-100 hover:text-gray-900'
                      }`}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Bottom — theme + sign out */}
      <div className={`px-2 py-3 border-t space-y-0.5 ${dark ? 'border-[#2e2016]' : 'border-amber-200'}`}>
        <button
          onClick={toggleDark}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition
            ${dark
              ? 'text-[#a08060] hover:bg-[#1e1409] hover:text-white'
              : 'text-gray-600 hover:bg-amber-100 hover:text-gray-900'
            }`}>
          {dark
            ? <><Sun className="w-4 h-4" /> Light Mode</>
            : <><Moon className="w-4 h-4" /> Dark Mode</>
          }
        </button>

        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition
            ${dark
              ? 'text-[#a08060] hover:bg-[#1e1409] hover:text-red-400'
              : 'text-gray-600 hover:bg-amber-100 hover:text-red-500'
            }`}>
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}