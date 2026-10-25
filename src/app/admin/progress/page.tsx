import { groupAssessmentAttempts } from '@/features/testing/assessmentSession'
import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Search, Clock, ChevronRight } from 'lucide-react'
import { Attempt } from '@/types/database.types'

interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function StudentProgressPage({ searchParams }: PageProps) {
  // Ensure user is authorized admin
  await requireAdmin()
  const { search } = await searchParams

  const supabase = await createClient()

  // 1. Fetch student profiles
  let studentQuery = supabase
    .from('users')
    .select('*')
    .eq('role', 'student')

  if (search) {
    studentQuery = studentQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: students, error: studentsError } = await studentQuery.order('created_at', { ascending: false })

  if (studentsError) {
    console.error('Error fetching students:', studentsError.message)
  }

  // 2. Fetch attempts for stats
  type ShortAttempt = Pick<Attempt, 'id' | 'user_id' | 'status' | 'started_at' | 'submitted_at' | 'cefr_level' | 'session_id'>
  let attempts: ShortAttempt[] = []
  if (students && students.length > 0) {
    const studentIds = students.map((s) => s.id)
    const { data: attemptsData, error: attemptsError } = await supabase
      .from('attempts')
      .select('id, user_id, status, started_at, submitted_at, cefr_level, session_id')
      .in('user_id', studentIds)
      .order('started_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching attempts:', attemptsError.message)
    } else {
      attempts = attemptsData || []
    }
  }

  // 3. Aggregate student stats in-memory
  const studentsWithStats = (students || []).map((student) => {
    const userAttempts = attempts.filter((a) => a.user_id === student.id)
    const submittedAttempts = userAttempts.filter((a) => a.status === 'SUBMITTED')

    const lastActivityAttempt = [...userAttempts].sort((a, b) =>
      new Date(b.submitted_at || b.started_at).getTime() - new Date(a.submitted_at || a.started_at).getTime())[0]
    const lastActivityDate = lastActivityAttempt
      ? new Date(lastActivityAttempt.submitted_at || lastActivityAttempt.started_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Never'

    const currentCEFR = submittedAttempts[0]?.cefr_level || student.current_cefr_level || 'N/A'

    return {
      ...student,
      totalAttempts: groupAssessmentAttempts(userAttempts).length,
      lastActivityDate,
      currentCEFR,
    }
  })

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-400" />
          <span>Student Progress & Analytics</span>
        </h1>
        <p className="text-xs text-slate-400">
          Track and review English proficiency performance metrics across student attempts.
        </p>
      </div>

      {/* Main card panel */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardHeader className="pb-4 border-b border-slate-800">
          <CardTitle className="text-base text-white">Student Roster</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Search students to review detailed timelines, evaluations, and question responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Search bar */}
          <form method="GET" action="/admin/progress" className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                name="search"
                placeholder="Search by name or email..."
                defaultValue={search || ''}
                className="w-full rounded-xl border border-slate-850 bg-slate-950/60 pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white transition cursor-pointer"
            >
              Search
            </button>
            {search && (
              <Link
                href="/admin/progress"
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 transition flex items-center justify-center"
              >
                Clear
              </Link>
            )}
          </form>

          {/* Roster list */}
          <div className="overflow-x-auto border border-slate-850 rounded-xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-mono uppercase font-bold tracking-wider">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4 text-center">Indicative CEFR</th>
                  <th className="px-6 py-4 text-center">Total Attempts</th>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/35">
                {studentsWithStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No student records found matching search filters.
                    </td>
                  </tr>
                ) : (
                  studentsWithStats.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-850/45 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-950 border border-indigo-850 flex items-center justify-center font-bold text-indigo-400 uppercase">
                            {(student.full_name || student.email || 'U').substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{student.full_name || 'Anonymous User'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          student.currentCEFR === 'N/A' 
                            ? 'bg-slate-950/60 border-slate-800 text-slate-500' 
                            : student.currentCEFR.startsWith('C')
                            ? 'bg-emerald-950/65 border-emerald-850 text-emerald-400'
                            : student.currentCEFR.startsWith('B')
                            ? 'bg-blue-950/65 border-blue-850 text-blue-400'
                            : 'bg-amber-950/65 border-amber-850 text-amber-400'
                        }`}>
                          {student.currentCEFR}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-semibold text-slate-300">
                        {student.totalAttempts}
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-600" />
                          <span>{student.lastActivityDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/progress/${student.id}`}>
                          <button className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase bg-slate-950 border border-slate-850 text-indigo-400 hover:text-indigo-300 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition cursor-pointer">
                            <span>View Profile</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
