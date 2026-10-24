import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/supabase/queries'
import { logoutAction } from '@/features/auth/actions'
import { createTestAttemptAction } from '@/features/testing/actions'
import { highestSubmittedScore, resolveAttemptSkill } from '@/features/testing/attemptIdentity'
import AttemptsHistory from './components/AttemptsHistory'
import { 
  Trophy, 
  Award, 
  User, 
  LogOut, 
  ClipboardList, 
  ShieldCheck,
  BrainCircuit,
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const profile = await getUserProfile(user.id)

  // Fetch real attempts from database with their respective evaluations and response evidence
  const { data: attempts } = await supabase
    .from('attempts')
    .select('*, tests(*), writing_evaluations(*), listening_responses(id), speaking_evaluations(*), responses(id)')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const userDisplayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner'

  // Server actions bound with section parameters
  const startReadingAction = createTestAttemptAction.bind(
    null, 
    'a4d70c5e-d63c-4384-a327-ee556c77d870', 
    'Reading'
  )
  const startListeningAction = createTestAttemptAction.bind(
    null, 
    'a4d70c5e-d63c-4384-a327-ee556c77d870', 
    'Listening'
  )
  const startWritingAction = createTestAttemptAction.bind(
    null, 
    'a4d70c5e-d63c-4384-a327-ee556c77d870', 
    'Writing'
  )
  const startSpeakingAction = createTestAttemptAction.bind(
    null, 
    'a4d70c5e-d63c-4384-a327-ee556c77d870', 
    'Speaking'
  )

  const completedAttempts = (attempts || []).filter((a) => a.status === 'SUBMITTED')
  const highestScore = highestSubmittedScore(attempts || [])
  const highestScoreDisplay = highestScore !== null ? String(highestScore) : 'N/A'
  const evaluatedAttemptsCount = completedAttempts.filter((a) => Boolean(a.cefr_level)).length

  const inProgressReading = (attempts || []).find(
    (a) => a.status === 'IN_PROGRESS' && resolveAttemptSkill(a) === 'Reading'
  )
  const inProgressListening = (attempts || []).find(
    (a) => a.status === 'IN_PROGRESS' && resolveAttemptSkill(a) === 'Listening'
  )
  const inProgressWriting = (attempts || []).find(
    (a) => a.status === 'IN_PROGRESS' && resolveAttemptSkill(a) === 'Writing'
  )
  const inProgressSpeaking = (attempts || []).find(
    (a) => a.status === 'IN_PROGRESS' && resolveAttemptSkill(a) === 'Speaking'
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg">
              <BrainCircuit className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              LinguaCert AI
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <User className="h-4 w-4 text-indigo-400" />
              <span>{userDisplayName}</span>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                <LogOut className="h-4 w-4 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-extrabold text-white">Welcome back, {userDisplayName}!</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor your proficiency levels and evaluate your language capability.</p>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-900/50 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Active CEFR Level</span>
              <Award className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">
                {profile?.current_cefr_level || 'B1'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Starting reference tier</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Tests Completed</span>
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">
                {completedAttempts.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total completed assessments</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Highest Score</span>
              <Trophy className="h-5 w-5 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">
                {highestScoreDisplay}
              </div>
              <p className="text-xs text-slate-500 mt-1">Out of 100 max points</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">CEFR Evaluations</span>
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">
                {evaluatedAttemptsCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">Evaluated skill assessments</p>
            </CardContent>
          </Card>
        </div>

        {/* Available Assessments */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Available Skill Assessments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Reading card */}
            <Card className="bg-slate-900/40 border border-slate-900 text-white flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <Play className="h-3.5 w-3.5 fill-indigo-400" />
                    <span>Reading Assessment</span>
                  </div>
                  {inProgressReading && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase font-bold">
                      In Progress
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold">Reading & Grammar Comprehension</CardTitle>
                <CardDescription className="text-slate-400 text-xs leading-relaxed">
                  Evaluate your vocabulary depth and comprehension skills using our adaptive English test metrics.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col justify-between h-full">
                <div className="text-xs text-slate-500 space-y-2 mb-6 border-t border-slate-900 pt-4">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-semibold text-slate-300">Adaptive Multiple Choice</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time limit:</span>
                    <span className="font-semibold text-slate-300">10 minutes</span>
                  </div>
                </div>
                <form action={startReadingAction}>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition">
                    {inProgressReading ? 'Resume Reading Test' : 'Start Reading Test'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Listening card */}
            <Card className="bg-slate-900/40 border border-slate-900 text-white flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 text-violet-400 text-xs font-bold uppercase tracking-wider">
                    <Play className="h-3.5 w-3.5 fill-violet-400" />
                    <span>Listening Assessment</span>
                  </div>
                  {inProgressListening && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase font-bold">
                      In Progress
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold">Listening Comprehension</CardTitle>
                <CardDescription className="text-slate-400 text-xs leading-relaxed">
                  Listen to audio scenarios and answer multiple-choice questions to determine your listening comprehension tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col justify-between h-full">
                <div className="text-xs text-slate-500 space-y-2 mb-6 border-t border-slate-900 pt-4">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-semibold text-slate-300">Audio MCQs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time limit:</span>
                    <span className="font-semibold text-slate-300">10 minutes</span>
                  </div>
                </div>
                <form action={startListeningAction}>
                  <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold transition">
                    {inProgressListening ? 'Resume Listening Test' : 'Start Listening Test'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Writing card */}
            <Card className="bg-slate-900/40 border border-slate-900 text-white flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Play className="h-3.5 w-3.5 fill-emerald-400" />
                    <span>Writing Assessment</span>
                  </div>
                  {inProgressWriting && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase font-bold">
                      In Progress
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold">Written Expression Essay</CardTitle>
                <CardDescription className="text-slate-400 text-xs leading-relaxed">
                  Write an essay on a specific prompt, evaluated instantly by advanced AI for fluency, vocabulary, and grammar.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col justify-between h-full">
                <div className="text-xs text-slate-500 space-y-2 mb-6 border-t border-slate-900 pt-4">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-semibold text-slate-300">Essay (100–400 words)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time limit:</span>
                    <span className="font-semibold text-slate-300">20 minutes</span>
                  </div>
                </div>
                <form action={startWritingAction}>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition">
                    {inProgressWriting ? 'Resume Writing Test' : 'Start Writing Test'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Speaking card */}
            <Card className="bg-slate-900/40 border border-slate-900 text-white flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                    <Play className="h-3.5 w-3.5 fill-rose-400" />
                    <span>Speaking Assessment</span>
                  </div>
                  {inProgressSpeaking && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase font-bold">
                      In Progress
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold">Spoken Expression Task</CardTitle>
                <CardDescription className="text-slate-400 text-xs leading-relaxed">
                  Record your voice discussing a given topic and receive instant AI assessment on fluency and pronunciation.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col justify-between h-full">
                <div className="text-xs text-slate-500 space-y-2 mb-6 border-t border-slate-900 pt-4">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-semibold text-slate-300">Oral Recording (60s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time limit:</span>
                    <span className="font-semibold text-slate-300">10 minutes</span>
                  </div>
                </div>
                <form action={startSpeakingAction}>
                  <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold transition">
                    {inProgressSpeaking ? 'Resume Speaking Test' : 'Start Speaking Test'}
                  </Button>
                </form>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Unified History List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Assessment Logs & Progress</h2>
          <AttemptsHistory attempts={attempts || []} />
        </div>
      </main>
    </div>
  )
}

