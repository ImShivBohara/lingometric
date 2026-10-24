import React from 'react'
import { requireAdmin } from '@/lib/supabase/guards'
import AdminSidebar from '@/features/admin/components/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <AdminSidebar profile={profile} />

      {/* Main Admin Workspace */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
