'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Users, 
  ClipboardList, 
  Award, 
  LogOut, 
  ShieldAlert, 
  Home, 
  ArrowLeft,
  FileText,
  BookOpen,
  Mic
} from 'lucide-react'
import { logoutAction } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'

interface AdminSidebarProps {
  profile: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

export default function AdminSidebar({ profile }: AdminSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { name: 'Overview', href: '/admin', icon: Home },
    { name: 'Listening Passages', href: '/admin/listening', icon: ClipboardList },
    { name: 'Reading Bank', href: '/admin/reading', icon: BookOpen },
    { name: 'Writing Prompts', href: '/admin/writing', icon: FileText },
    { name: 'Speaking Prompts', href: '/admin/speaking', icon: Mic },
    { name: 'Student Progress', href: '/admin/progress', icon: Users },
    { name: 'Analytics', href: '#', icon: Award, disabled: true },
  ]

  const handleLogout = async () => {
    await logoutAction()
  }

  const adminName = profile.full_name || profile.email.split('@')[0] || 'Admin'

  return (
    <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col justify-between flex-shrink-0">
      <div className="p-6 space-y-8">
        {/* Brand logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/15 border border-indigo-500/30 rounded-xl">
            <ShieldAlert className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              LingoMetric Admin
            </h1>
            <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Management</p>
          </div>
        </div>

        {/* User Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 uppercase">
            {adminName.substring(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{adminName}</div>
            <div className="text-[10px] text-slate-500 truncate">{profile.email}</div>
          </div>
        </div>

        {/* Nav list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 text-xs font-bold tracking-wide rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-500/10' 
                    : item.disabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.name}</span>
                {item.disabled && (
                  <span className="ml-auto text-[8px] bg-slate-900 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md uppercase font-mono font-bold">
                    Phase 7
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-slate-900 space-y-2">
        <Link href="/dashboard" className="w-full">
          <Button
            variant="outline"
            className="w-full justify-start border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200 px-4 py-2 text-xs rounded-xl flex items-center gap-2 font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Button>
        </Link>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 px-4 py-2 text-xs rounded-xl flex items-center gap-2 font-semibold"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout Session</span>
        </Button>
      </div>
    </aside>
  )
}
