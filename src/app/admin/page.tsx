import { groupAssessmentAttempts } from '@/features/testing/assessmentSession'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ClipboardList, Award, ShieldAlert } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Run database count queries (attempts count requires Admin SELECT policy)
  const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student')
  const { count: testsCount } = await supabase.from('tests').select('*', { count: 'exact', head: true })
  const { data: attempts } = await supabase.from('attempts').select('id, session_id')
  const attemptsCount = groupAssessmentAttempts(attempts || []).length

  const stats = [
    {
      title: 'Total Students',
      value: usersCount ?? 0,
      description: 'Registered student profiles',
      icon: Users,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Configured Tests',
      value: testsCount ?? 0,
      description: 'Tests defined in database',
      icon: Award,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Test Attempts',
      value: attemptsCount ?? 0,
      description: 'Completed or in-progress attempts',
      icon: ClipboardList,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
  ]

  return (
    <div className="space-y-8 font-sans">
      {/* Overview Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Admin Control Center
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Welcome to the LingoMetric Admin Control Center. Manage skill questions, tests, and student analytics.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 border rounded-xl ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-white tracking-tight">{stat.value}</div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Administrative Welcome Card */}
      <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
          <div className="p-4 bg-indigo-500/15 border border-indigo-500/30 rounded-2xl">
            <ShieldAlert className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Administrative Interface Shell</h2>
          <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
            You are securely logged in with administrator privileges. All routes matching the `/admin` path namespace are protected by the `requireAdmin` server guard utility. 
          </p>
          <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4 max-w-md text-left text-xs font-mono text-slate-500 space-y-1">
            <div>Profile Authorized: OK</div>
            <div>Database Access Scope: READ-ONLY (Shell)</div>
            <div>Active Guard Context: requireAdmin() → Verified</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
