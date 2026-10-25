import SessionHistory from '@/features/testing/components/SessionHistory'
import { groupAssessmentAttempts, summarizeSession } from '@/features/testing/assessmentSession'
import { resolveAttemptSkill } from '@/features/testing/attemptIdentity'
import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  TrendingUp, 
  BookOpen, 
  Mic, 
  FileText, 
  Volume2,
  Calendar,
  CheckCircle,
  XCircle,
  HelpCircle,
  Users
} from 'lucide-react'
import { 
  UserProfile, 
  Test, 
  Attempt, 
  Response, 
  Question, 
  WritingEvaluation, 
  SpeakingEvaluation 
} from '@/types/database.types'

interface ExtendedReadingResponse extends Response {
  questions: Question | null
}

interface DatabaseListeningPassage {
  id: string
  section_id: string
  title: string
  audio_url: string
  duration_seconds: number
  transcript: string | null
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  created_at: string
}

interface DatabaseListeningQuestion {
  id: string
  passage_id: string
  question_text: string
  options: string[] | unknown
  correct_answer: string
  explanation: string | null
  created_at: string
  listening_passages: DatabaseListeningPassage | null
}

interface DatabaseListeningResponse {
  id: string
  attempt_id: string
  question_id: string
  selected_answer: string
  is_correct: boolean
  score: number | null
  time_taken_seconds: number | null
  created_at: string
  listening_questions: DatabaseListeningQuestion | null
}

interface ExtendedAttempt extends Attempt {
  tests: Test | null
  responses: ExtendedReadingResponse[] | null
  listening_responses: DatabaseListeningResponse[] | null
  writing_evaluations: WritingEvaluation[] | null
  speaking_evaluations: (SpeakingEvaluation & { signed_audio_url?: string })[] | null
}

interface Props {
  params: Promise<{ studentId: string }>
}

interface QualitativeFeedback {
  strengths?: string[]
  weaknesses?: string[]
  suggestions?: string[]
  general_feedback?: string
}

export default async function StudentDetailDashboardPage({ params }: Props) {
  // Enforce admin access
  await requireAdmin()
  const { studentId } = await params

  const supabase = await createClient()

  // 1. Fetch student user profile info
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('*')
    .eq('id', studentId)
    .eq('role', 'student')
    .single()

  if (studentError || !student) {
    notFound()
  }

  // 2. Fetch student attempts with nested selections and evaluations
  const { data: attemptsData, error: attemptsError } = await supabase
    .from('attempts')
    .select(`
      *,
      tests (*),
      responses (
        *,
        questions (*)
      ),
      listening_responses (
        *,
        listening_questions (
          *,
          listening_passages (*)
        )
      ),
      writing_evaluations (*),
      speaking_evaluations (*)
    `)
    .eq('user_id', studentId)
    .order('started_at', { ascending: false })

  if (attemptsError) {
    console.error('Failed to load attempts:', attemptsError.message)
  }


  // Cast retrieved data safely to ExtendedAttempt[]
  const rawAttempts = (attemptsData as unknown as ExtendedAttempt[]) || []
  
  // 3. Process attempts: Generate signed URLs for speaking evaluation recordings
  const attempts = await Promise.all(
    rawAttempts.map(async (attempt) => {
      const speakingEval = attempt.speaking_evaluations?.[0]
      if (speakingEval && speakingEval.audio_url) {
        try {
          const { data: signedData, error: signedError } = await supabase
            .storage
            .from('speaking-audio')
            .createSignedUrl(speakingEval.audio_url, 3600)

          if (!signedError && signedData) {
            return {
              ...attempt,
              speaking_evaluations: [
                {
                  ...speakingEval,
                  signed_audio_url: signedData.signedUrl,
                },
              ],
            }
          }
        } catch (e) {
          console.error('Error generating audio signed URL:', e)
        }
      }
      return attempt
    })
  )

  // 4. Compute student aggregate statistics in-memory
  const assessmentGroups = groupAssessmentAttempts(attempts)
  const totalAttempts = assessmentGroups.length
  const completedGroups = assessmentGroups.filter(group => group[0].session_id ? summarizeSession(group).complete : group[0].status === 'SUBMITTED')
  const submittedAttempts = attempts.filter((a) => a.status === 'SUBMITTED')
  const completionRate = totalAttempts > 0 ? Math.round((completedGroups.length / totalAttempts) * 100) : 0
  const scores = completedGroups.map(group => group[0].session_id ? summarizeSession(group).score : group[0].final_score)
    .filter((score): score is number => score != null)
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
  const currentCEFR = submittedAttempts[0]?.cefr_level || (student as UserProfile).current_cefr_level || 'N/A'

  // Chronological list of submitted attempts for progression timeline
  const timelineAttempts = [...submittedAttempts].reverse()

  // Helper to calculate averages safely
  const calculateAverage = (scores: number[]) => {
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A'
  }

  // Reading stats
  const readingAttempts = submittedAttempts.filter((a) => resolveAttemptSkill(a) === 'Reading')
  const allReadingResponses = readingAttempts.flatMap((a) => a.responses || [])
  const correctReadingCount = allReadingResponses.filter((r) => r.is_correct).length
  const avgReadingScore = calculateAverage(readingAttempts.map((a) => Number(a.final_score || 0)))

  // Listening stats
  const listeningAttempts = submittedAttempts.filter((a) => resolveAttemptSkill(a) === 'Listening')
  const allListeningResponses = listeningAttempts.flatMap((a) => a.listening_responses || [])
  const correctListeningCount = allListeningResponses.filter((r) => r.is_correct).length
  const avgListeningScore = calculateAverage(listeningAttempts.map((a) => Number(a.final_score || 0)))

  // Writing evaluations averages
  const writingEvals = attempts.map((a) => a.writing_evaluations?.[0]).filter(Boolean) as WritingEvaluation[]
  const avgWritingCoherence = calculateAverage(writingEvals.map((w) => Number(w.coherence_score || 0)))
  const avgWritingFluency = calculateAverage(writingEvals.map((w) => Number(w.fluency_score || 0)))
  const avgWritingGrammar = calculateAverage(writingEvals.map((w) => Number(w.grammar_score || 0)))
  const avgWritingVocab = calculateAverage(writingEvals.map((w) => Number(w.vocabulary_score || 0)))
  const avgWritingOverall = calculateAverage(writingEvals.map((w) => Number(w.overall_score || 0)))

  // Speaking evaluations averages
  const speakingEvals = attempts.map((a) => a.speaking_evaluations?.[0]).filter(Boolean) as SpeakingEvaluation[]
  const avgSpeakingPronunciation = calculateAverage(speakingEvals.map((s) => Number(s.pronunciation_score || 0)))
  const avgSpeakingGrammar = calculateAverage(speakingEvals.map((s) => Number(s.grammar_score || 0)))
  const avgSpeakingFluency = calculateAverage(speakingEvals.map((s) => Number(s.fluency_score || 0)))
  const avgSpeakingVocab = calculateAverage(speakingEvals.map((s) => Number(s.vocabulary_score || 0)))
  const avgSpeakingOverall = calculateAverage(speakingEvals.map((s) => Number(s.overall_score || 0)))

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto text-slate-100 font-sans">
      {/* Back link */}
      <div>
        <Link href="/admin/progress">
          <Button variant="outline" size="sm" className="border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200 gap-1.5 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Roster</span>
          </Button>
        </Link>
      </div>

      {/* Profile summary */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-indigo-900/35 border border-indigo-700/30 flex items-center justify-center font-bold text-indigo-400 text-xl uppercase">
            {(student.full_name || student.email || 'U').substring(0, 2)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{student.full_name || 'Anonymous Learner'}</h1>
            <p className="text-xs text-slate-500 font-mono">{student.email}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Joined: {new Date(student.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-950/60 border border-slate-850 px-4 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-mono">Indicative CEFR</div>
            <div className="text-base font-bold text-emerald-400">{currentCEFR}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 px-4 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-mono">Attempts</div>
            <div className="text-base font-bold text-white font-mono">{totalAttempts}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 px-4 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-mono">Avg Score</div>
            <div className="text-base font-bold text-indigo-400 font-mono">{averageScore}%</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 px-4 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-mono">Completion Rate</div>
            <div className="text-base font-bold text-slate-300 font-mono">{completionRate}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Progression & Skill Summaries */}
        <div className="lg:col-span-1 space-y-6">
          {/* Progression timeline */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <span>Indicative CEFR Progression</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {timelineAttempts.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No completed attempts recorded.</p>
              ) : (
                <div className="relative border-l border-slate-850 pl-4 py-1.5 space-y-6">
                  {timelineAttempts.map((attempt) => (
                    <div key={attempt.id} className="relative">
                      {/* Bullet circle */}
                      <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-slate-900 bg-indigo-500" />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-400 font-mono">{attempt.cefr_level || 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(attempt.submitted_at || attempt.started_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-semibold truncate">
                          {attempt.tests?.title || 'English Level Test'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Score achieved: <span className="font-mono text-slate-300 font-bold">{attempt.final_score}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skill Performance Summaries */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <span>Skill Breakdowns</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Reading Card */}
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                    <span>Reading Performance</span>
                  </span>
                  <span className="font-bold font-mono text-indigo-400">{avgReadingScore}% Avg</span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                  <span>Total Answers: {allReadingResponses.length}</span>
                  <span>Correct: {correctReadingCount} ({allReadingResponses.length > 0 ? Math.round((correctReadingCount/allReadingResponses.length)*100) : 0}%)</span>
                </div>
              </div>

              {/* Listening Card */}
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Listening Performance</span>
                  </span>
                  <span className="font-bold font-mono text-indigo-400">{avgListeningScore}% Avg</span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                  <span>Total Answers: {allListeningResponses.length}</span>
                  <span>Correct: {correctListeningCount} ({allListeningResponses.length > 0 ? Math.round((correctListeningCount/allListeningResponses.length)*100) : 0}%)</span>
                </div>
              </div>

              {/* Writing Metrics */}
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-purple-400" />
                    <span>Writing Evaluations</span>
                  </span>
                  <span className="font-bold font-mono text-indigo-400">{avgWritingOverall}% Avg</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Coherence:</span>
                    <span className="text-white font-bold">{avgWritingCoherence}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Fluency:</span>
                    <span className="text-white font-bold">{avgWritingFluency}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Grammar:</span>
                    <span className="text-white font-bold">{avgWritingGrammar}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Vocabulary:</span>
                    <span className="text-white font-bold">{avgWritingVocab}</span>
                  </div>
                </div>
              </div>

              {/* Speaking Metrics */}
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-rose-400" />
                    <span>Speaking Evaluations</span>
                  </span>
                  <span className="font-bold font-mono text-indigo-400">{avgSpeakingOverall}% Avg</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Pronunciation:</span>
                    <span className="text-white font-bold">{avgSpeakingPronunciation}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Fluency:</span>
                    <span className="text-white font-bold">{avgSpeakingFluency}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Grammar:</span>
                    <span className="text-white font-bold">{avgSpeakingGrammar}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-0.5">
                    <span>Vocabulary:</span>
                    <span className="text-white font-bold">{avgSpeakingVocab}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Expandable Attempt Details */}
        <div className="lg:col-span-2 space-y-4">
          <SessionHistory attempts={attempts} admin />
          <h2 className="text-base font-bold text-white">Section Attempt Details</h2>

          {attempts.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/60 p-6 text-center text-slate-500 text-xs">
              No historical attempts exist for this student.
            </Card>
          ) : (
            attempts.map((attempt) => {
              const writingEval = attempt.writing_evaluations?.[0]
              const speakingEval = attempt.speaking_evaluations?.[0]
              const readingResponses = attempt.responses || []
              const listeningResponses = attempt.listening_responses || []

              const isReadingAttempt = resolveAttemptSkill(attempt) === 'Reading'
              const isListeningAttempt = resolveAttemptSkill(attempt) === 'Listening'

              const attemptDate = new Date(attempt.submitted_at || attempt.started_at).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <details 
                  key={attempt.id} 
                  className="group border border-slate-855 bg-slate-900/35 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-855/35 transition text-xs font-semibold">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                      <div>
                        <div className="text-white font-bold">{attempt.tests?.title || 'Unknown Test'}</div>
                        {attempt.session_id && <div className="text-[10px] text-slate-400">Full assessment: {attempt.session_id}</div>}
                        <div className="text-[10px] text-slate-500 font-mono">{attemptDate}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          attempt.status === 'SUBMITTED' 
                            ? 'bg-emerald-950/65 text-emerald-400 border border-emerald-850' 
                            : 'bg-amber-950/65 text-amber-400 border border-amber-850'
                        }`}>
                          {attempt.status}
                        </span>
                        {isReadingAttempt && (
                          <span className="bg-blue-950 border border-blue-850 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                            Reading
                          </span>
                        )}
                        {isListeningAttempt && (
                          <span className="bg-emerald-950 border border-emerald-850 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                            Listening
                          </span>
                        )}
                        {writingEval && (
                          <span className="bg-purple-950 border border-purple-850 text-purple-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                            Writing
                          </span>
                        )}
                        {speakingEval && (
                          <span className="bg-rose-950 border border-rose-850 text-rose-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                            Speaking
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-indigo-400 font-mono font-bold text-sm">
                          {attempt.final_score != null ? `${attempt.final_score}%` : 'N/A'}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-wider">
                          CEFR: <span className="text-emerald-400 font-extrabold">{attempt.cefr_level || 'N/A'}</span>
                        </div>
                      </div>
                      <span className="text-slate-600 group-open:rotate-180 transition-transform duration-200">▼</span>
                    </div>
                  </summary>

                  <div className="p-5 border-t border-slate-855 bg-slate-950/50 space-y-6 text-xs text-slate-300">
                    {/* Status warning */}
                    {attempt.status === 'IN_PROGRESS' && (
                      <div className="bg-amber-950/20 border border-amber-850/40 text-amber-400/80 p-3 rounded-xl">
                        This test attempt is currently in progress. Detailed results will finalize upon submission.
                      </div>
                    )}

                    {/* READING DETAILS */}
                    {isReadingAttempt && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-white border-b border-slate-855 pb-1 flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                          <span>Reading Question Review</span>
                        </h3>
                        <div className="space-y-3">
                          {readingResponses.map((res, idx) => (
                            <div key={res.id} className="bg-slate-900/40 border border-slate-855/80 rounded-xl p-3.5 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-slate-200">
                                  Q{idx + 1}. {res.questions?.question_text || 'No question text available.'}
                                </div>
                                <span className="flex-shrink-0">
                                  {res.is_correct ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-rose-500" />
                                  )}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-900">
                                  <span className="text-slate-500 mr-2">Selected:</span>
                                  <span className={res.is_correct ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                                    {res.selected_answer}
                                  </span>
                                </div>
                                <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-900">
                                  <span className="text-slate-500 mr-2">Correct:</span>
                                  <span className="text-emerald-400 font-bold">{res.questions?.correct_answer}</span>
                                </div>
                              </div>
                              {res.questions?.explanation && (
                                <div className="bg-slate-950/30 p-2.5 rounded-lg text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                                  <HelpCircle className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                                  <span>{res.questions.explanation}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LISTENING DETAILS */}
                    {isListeningAttempt && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-white border-b border-slate-855 pb-1 flex items-center gap-1.5">
                          <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Listening Question Review</span>
                        </h3>
                        <div className="space-y-3">
                          {listeningResponses.map((res, idx) => {
                            const passage = res.listening_questions?.listening_passages
                            return (
                              <div key={res.id} className="bg-slate-900/40 border border-slate-855/80 rounded-xl p-3.5 space-y-3">
                                {passage && (
                                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                                    <div className="font-bold text-indigo-400 text-[10px] font-mono uppercase mb-1">
                                      Passage: {passage.title}
                                    </div>
                                    <div className="text-[10px] text-slate-400 leading-normal max-h-20 overflow-y-auto italic">
                                      &ldquo;{passage.transcript}&rdquo;
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-slate-200">
                                    Q{idx + 1}. {res.listening_questions?.question_text || 'No question text available.'}
                                  </div>
                                  <span className="flex-shrink-0">
                                    {res.is_correct ? (
                                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-rose-500" />
                                    )}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                  <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-900">
                                    <span className="text-slate-500 mr-2">Selected:</span>
                                    <span className={res.is_correct ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                                      {res.selected_answer}
                                    </span>
                                  </div>
                                  <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-900">
                                    <span className="text-slate-500 mr-2">Correct:</span>
                                    <span className="text-emerald-400 font-bold">{res.listening_questions?.correct_answer}</span>
                                  </div>
                                </div>
                                {res.listening_questions?.explanation && (
                                  <div className="bg-slate-950/30 p-2.5 rounded-lg text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                                    <HelpCircle className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                                    <span>{res.listening_questions.explanation}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* WRITING DETAILS */}
                    {writingEval && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-white border-b border-slate-855 pb-1 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-purple-400" />
                          <span>Writing Evaluation Details</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-slate-300">
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Overall</div>
                            <div className="text-sm font-bold text-indigo-400">{writingEval.overall_score}%</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Coherence</div>
                            <div className="text-sm font-bold text-slate-300">{writingEval.coherence_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Fluency</div>
                            <div className="text-sm font-bold text-slate-300">{writingEval.fluency_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Grammar</div>
                            <div className="text-sm font-bold text-slate-300">{writingEval.grammar_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Vocabulary</div>
                            <div className="text-sm font-bold text-slate-300">{writingEval.vocabulary_score}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Essay Submission</div>
                          <div className="bg-slate-950/65 border border-slate-855 p-4 rounded-xl text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto italic font-sans whitespace-pre-wrap">
                            &ldquo;{writingEval.essay_text}&rdquo;
                          </div>
                        </div>

                        {/* Qualitative feedback */}
                        {writingEval.feedback && (
                          <div className="bg-slate-900/40 border border-slate-855 rounded-xl p-4 space-y-3 text-[11px]">
                            {(writingEval.feedback as QualitativeFeedback).general_feedback && (
                              <div className="space-y-1">
                                <span className="font-bold text-slate-400">Analysis Summary:</span>
                                <p className="text-slate-300 leading-normal">{(writingEval.feedback as QualitativeFeedback).general_feedback}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                              {(writingEval.feedback as QualitativeFeedback).strengths && ((writingEval.feedback as QualitativeFeedback).strengths || []).length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-bold text-emerald-400">Strengths:</span>
                                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                                    {((writingEval.feedback as QualitativeFeedback).strengths || []).map((str, index) => (
                                      <li key={index}>{str}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(writingEval.feedback as QualitativeFeedback).weaknesses && ((writingEval.feedback as QualitativeFeedback).weaknesses || []).length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-bold text-rose-400">Improvement Areas:</span>
                                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                                    {((writingEval.feedback as QualitativeFeedback).weaknesses || []).map((weak, index) => (
                                      <li key={index}>{weak}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SPEAKING DETAILS */}
                    {speakingEval && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-white border-b border-slate-855 pb-1 flex items-center gap-1.5">
                          <Mic className="h-3.5 w-3.5 text-rose-400" />
                          <span>Speaking Evaluation Details</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-slate-300">
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Overall</div>
                            <div className="text-sm font-bold text-indigo-400">{speakingEval.overall_score}%</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Pronunciation</div>
                            <div className="text-sm font-bold text-slate-300">{speakingEval.pronunciation_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Fluency</div>
                            <div className="text-sm font-bold text-slate-300">{speakingEval.fluency_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Grammar</div>
                            <div className="text-sm font-bold text-slate-300">{speakingEval.grammar_score}</div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-855 p-2.5 rounded-lg">
                            <div className="text-[9px] text-slate-500 uppercase font-mono">Vocabulary</div>
                            <div className="text-sm font-bold text-slate-300">{speakingEval.vocabulary_score}</div>
                          </div>
                        </div>

                        {/* Audio review */}
                        {speakingEval.signed_audio_url && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Voice Recording Review</div>
                            <audio 
                              controls 
                              src={speakingEval.signed_audio_url} 
                              className="w-full bg-slate-950 border border-slate-855 rounded-xl px-2 py-1.5 focus:outline-none" 
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Voice Transcription</div>
                          <div className="bg-slate-950/65 border border-slate-855 p-4 rounded-xl text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto italic font-sans whitespace-pre-wrap">
                            &ldquo;{speakingEval.transcript || 'No spoken transcript available.'}&rdquo;
                          </div>
                        </div>

                        {/* Qualitative feedback */}
                        {speakingEval.feedback && (
                          <div className="bg-slate-900/40 border border-slate-855 rounded-xl p-4 space-y-3 text-[11px]">
                            {(speakingEval.feedback as QualitativeFeedback).general_feedback && (
                              <div className="space-y-1">
                                <span className="font-bold text-slate-400">Analysis Summary:</span>
                                <p className="text-slate-300 leading-normal">{(speakingEval.feedback as QualitativeFeedback).general_feedback}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                              {(speakingEval.feedback as QualitativeFeedback).strengths && ((speakingEval.feedback as QualitativeFeedback).strengths || []).length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-bold text-emerald-400">Strengths:</span>
                                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                                    {((speakingEval.feedback as QualitativeFeedback).strengths || []).map((str, index) => (
                                      <li key={index}>{str}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(speakingEval.feedback as QualitativeFeedback).weaknesses && ((speakingEval.feedback as QualitativeFeedback).weaknesses || []).length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-bold text-rose-400">Improvement Areas:</span>
                                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                                    {((speakingEval.feedback as QualitativeFeedback).weaknesses || []).map((weak, index) => (
                                      <li key={index}>{weak}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
