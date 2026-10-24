import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Award, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import { createTestAttemptAction } from '@/features/testing/actions'

export default async function TestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const startAction = createTestAttemptAction.bind(null, 'a4d70c5e-d63c-4384-a327-ee556c77d870', 'Reading')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl z-10 space-y-6">
        <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200 transition">
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span>Back to Dashboard</span>
        </Link>

        <Card className="border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-2xl text-slate-100 p-6">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto p-3 bg-indigo-600/10 border border-indigo-500/30 rounded-full w-fit text-indigo-400">
              <Award className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-white">English Proficiency Assessment</CardTitle>
            <CardDescription className="text-slate-400 text-sm max-w-md mx-auto">
              This assessment evaluates your Reading skills dynamically using standardized CEFR scales.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-sm text-slate-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-slate-800 py-6 my-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Format</span>
                <p className="font-semibold text-white">Reading Section (MVP)</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Starting Level</span>
                <p className="font-semibold text-white">B1 (Threshold)</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Estimated Time</span>
                <p className="font-semibold text-white">~10 Minutes</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Scoring</span>
                <p className="font-semibold text-white">0-100 Scale</p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-2 leading-relaxed">
              <p className="font-semibold text-slate-300">Important Instructions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Read each question and select the correct answer.</li>
                <li>Do not reload or navigate away from the test.</li>
                <li>Your time spent per question is tracked for performance diagnostics.</li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="pt-4">
            <form action={startAction} className="w-full">
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition duration-200">
                <Play className="h-4 w-4 mr-2" />
                <span>Start Assessment</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
