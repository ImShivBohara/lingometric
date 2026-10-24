import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { 
  Trophy, 
  CheckCircle, 
  Clock, 
  Home, 
  ThumbsUp, 
  AlertCircle, 
  Lightbulb, 
  CornerDownRight 
} from 'lucide-react'

interface ResultsPageProps {
  params: Promise<{ attemptId: string }>
}

export default async function TestResultsPage({ params }: ResultsPageProps) {
  const { attemptId } = await params
  const supabase = await createClient()

  // Get active user context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch attempt details and verify ownership
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('*, tests(*)')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (attemptError || !attempt) {
    console.error('Attempt results verification failed:', attemptError?.message)
    redirect('/dashboard')
  }

  if (attempt.status !== 'SUBMITTED') {
    redirect(`/test/${attemptId}`)
  }

  // Query writing evaluation for this attempt to determine if it is a Writing attempt
  const { data: writingEval, error: writingError } = await supabase
    .from('writing_evaluations')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle()

  if (writingError) {
    console.error('Failed to query writing evaluations:', writingError.message)
  }

  // Query speaking evaluation to determine if it is a Speaking attempt
  const { data: speakingEval, error: speakingError } = await supabase
    .from('speaking_evaluations')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle()

  if (speakingError) {
    console.error('Failed to query speaking evaluations:', speakingError.message)
  }

  // Generate temporary signed URL for private audio recording review
  let signedAudioUrl = ''
  if (speakingEval && speakingEval.audio_url) {
    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('speaking-audio')
      .createSignedUrl(speakingEval.audio_url, 3600) // 1 hour expiry
    
    if (!signedError && signedData) {
      signedAudioUrl = signedData.signedUrl
    }
  }

  // BRANCH 4: Dedicated Speaking Results UI
  if (speakingEval) {
    const feedback = (speakingEval.feedback as {
      strengths?: string[]
      weaknesses?: string[]
      suggestions?: string[]
      general_feedback?: string
    }) || {}

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Decorative gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-900/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl z-10 space-y-6 my-10">
          <Card className="border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-2xl text-slate-100 p-6">
            <CardHeader className="text-center space-y-2 pb-6 border-b border-slate-800/85">
              <div className="mx-auto p-4 bg-rose-600/10 border border-rose-500/30 rounded-full w-fit text-rose-400">
                <Trophy className="h-10 w-10" />
              </div>
              <CardTitle className="text-2xl font-extrabold text-white">Speaking Assessment Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Instant AI Speech & Fluency Evaluation
              </CardDescription>
            </CardHeader>

            <CardContent className="py-6 space-y-6">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Overall Score</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{speakingEval.overall_score}%</div>
                  <span className="text-xs text-slate-500">proficiency weight</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">CEFR Level</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{speakingEval.cefr_level}</div>
                  <span className="text-xs text-slate-500">standard alignment</span>
                </div>
              </div>

              {/* Subscores Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/60 pt-6">
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Grammar</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{speakingEval.grammar_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Vocabulary</div>
                  <div className="text-lg font-bold text-blue-400 mt-1">{speakingEval.vocabulary_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Pronunciation</div>
                  <div className="text-lg font-bold text-purple-400 mt-1">{speakingEval.pronunciation_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Fluency</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{speakingEval.fluency_score}</div>
                </div>
              </div>

              {/* Recorded Audio Review */}
              {signedAudioUrl && (
                <div className="space-y-2 border-t border-slate-800/60 pt-6">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Your Voice Recording</span>
                  <audio controls src={signedAudioUrl} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 focus:outline-none" />
                </div>
              )}

              {/* Speech Transcript */}
              <div className="space-y-2 border-t border-slate-800/60 pt-6">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Spoken Transcript</span>
                <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {speakingEval.transcript || 'No transcript available.'}
                </div>
              </div>

              {/* Qualitative AI Feedback */}
              <div className="space-y-6 border-t border-slate-800/60 pt-6">
                {feedback.general_feedback && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block font-mono">Overview Analysis</span>
                    <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-800/40 rounded-xl p-4">
                      {feedback.general_feedback}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Key Strengths</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-emerald-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {feedback.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      )) || <li>No analysis registered.</li>}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Grammar & Flow Warnings</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-rose-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {feedback.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                          <span>{w}</span>
                        </li>
                      )) || <li>No speech warnings detected.</li>}
                    </ul>
                  </div>
                </div>

                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      <span>Actionable Rephrasing Suggestions</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-amber-950/30 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
                      {feedback.suggestions.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CornerDownRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-slate-800/60 flex gap-4">
              <Link 
                href="/dashboard" 
                className={buttonVariants({ 
                  className: "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition py-5 rounded-xl flex items-center justify-center space-x-2" 
                })}
              >
                <Home className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  // Query listening responses to determine if it is a Listening attempt
  const { data: listeningResponses, error: listeningError } = await supabase
    .from('listening_responses')
    .select('is_correct, time_taken_seconds')
    .eq('attempt_id', attemptId)

  if (listeningError) {
    console.error('Failed to query listening responses:', listeningError.message)
  }

  // BRANCH 3: Dedicated Listening Results UI
  if (listeningResponses && listeningResponses.length > 0) {
    const totalQuestions = listeningResponses.length
    const correctCount = listeningResponses.filter((r) => r.is_correct).length
    const totalDurationSeconds = listeningResponses.reduce((acc, r) => acc + (r.time_taken_seconds || 0), 0)
    const minutes = Math.floor(totalDurationSeconds / 60)
    const seconds = totalDurationSeconds % 60
    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Decorative gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-xl z-10 space-y-6">
          <Card className="border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-2xl text-slate-100 p-6">
            <CardHeader className="text-center space-y-2 pb-8 border-b border-slate-800/85">
              <div className="mx-auto p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-full w-fit text-emerald-400">
                <Trophy className="h-10 w-10" />
              </div>
              <CardTitle className="text-2xl font-extrabold text-white">Listening Assessment Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Standard Listening Level Test results
              </CardDescription>
            </CardHeader>

            <CardContent className="py-8 space-y-8">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Final Score</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{attempt.final_score}%</div>
                  <span className="text-xs text-slate-500">proficiency weight</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">CEFR Level</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{attempt.cefr_level}</div>
                  <span className="text-xs text-slate-500">standard alignment</span>
                </div>
              </div>

              {/* Detailed stats info items */}
              <div className="space-y-4 border-t border-b border-slate-800 py-6">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <CheckCircle className="h-4 w-4 text-indigo-400" />
                    <span>Correct Answers</span>
                  </div>
                  <span className="font-semibold text-white">{correctCount} / {totalQuestions}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <span>Total Time Taken</span>
                  </div>
                  <span className="font-semibold text-white">{durationText}</span>
                </div>
              </div>

              {/* CEFR Level description paragraph */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-200 block mb-1">CEFR Scale Level {attempt.cefr_level}:</span>
                {attempt.cefr_level === 'A1' && 'Can understand and use familiar everyday expressions and very basic phrases.'}
                {attempt.cefr_level === 'A2' && 'Can understand sentences and frequently used expressions related to areas of most immediate relevance.'}
                {attempt.cefr_level === 'B1' && 'Can understand the main points of clear standard input on familiar matters regularly encountered.'}
                {attempt.cefr_level === 'B2' && 'Can understand the main ideas of complex text on both concrete and abstract topics.'}
                {attempt.cefr_level === 'C1' && 'Can understand a wide range of demanding, longer texts, and recognise implicit meaning.'}
                {attempt.cefr_level === 'C2' && 'Can understand with ease practically everything heard or read.'}
              </div>
            </CardContent>

            <CardFooter className="pt-4 flex gap-4">
              <Link 
                href="/dashboard" 
                className={buttonVariants({ 
                  className: "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition py-5 rounded-xl flex items-center justify-center space-x-2" 
                })}
              >
                <Home className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  // BRANCH 1: Dedicated Writing Results UI
  if (writingEval) {
    const feedback = (writingEval.feedback as {
      strengths?: string[]
      weaknesses?: string[]
      suggestions?: string[]
      general_feedback?: string
    }) || {}

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Decorative gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl z-10 space-y-6 my-10">
          <Card className="border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-2xl text-slate-100 p-6">
            <CardHeader className="text-center space-y-2 pb-6 border-b border-slate-800/85">
              <div className="mx-auto p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-full w-fit text-emerald-400">
                <Trophy className="h-10 w-10" />
              </div>
              <CardTitle className="text-2xl font-extrabold text-white">Writing Assessment Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Instant AI Performance Evaluation
              </CardDescription>
            </CardHeader>

            <CardContent className="py-6 space-y-6">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Overall Score</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{writingEval.overall_score}%</div>
                  <span className="text-xs text-slate-500">proficiency weight</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">CEFR Level</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{writingEval.cefr_level}</div>
                  <span className="text-xs text-slate-500">standard alignment</span>
                </div>
              </div>

              {/* Subscores Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/60 pt-6">
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Grammar</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{writingEval.grammar_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Vocabulary</div>
                  <div className="text-lg font-bold text-blue-400 mt-1">{writingEval.vocabulary_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Coherence</div>
                  <div className="text-lg font-bold text-purple-400 mt-1">{writingEval.coherence_score}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Fluency</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{writingEval.fluency_score}</div>
                </div>
              </div>

              {/* Submitted Essay */}
              <div className="space-y-2 border-t border-slate-800/60 pt-6">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Your Essay Submission</span>
                <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {writingEval.essay_text}
                </div>
              </div>

              {/* Qualitative AI Feedback */}
              <div className="space-y-6 border-t border-slate-800/60 pt-6">
                {feedback.general_feedback && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block font-mono">Overview Analysis</span>
                    <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-800/40 rounded-xl p-4">
                      {feedback.general_feedback}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Key Strengths</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-emerald-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {feedback.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      )) || <li>No analysis registered.</li>}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Grammar & Flow Warnings</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-rose-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {feedback.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                          <span>{w}</span>
                        </li>
                      )) || <li>No grammar errors detected.</li>}
                    </ul>
                  </div>
                </div>

                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      <span>Actionable Rephrasing Suggestions</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-amber-950/30 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
                      {feedback.suggestions.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CornerDownRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-slate-800/60 flex gap-4">
              <Link 
                href="/dashboard" 
                className={buttonVariants({ 
                  className: "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition py-5 rounded-xl flex items-center justify-center space-x-2" 
                })}
              >
                <Home className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  // BRANCH 2: Existing Reading Results UI (completely unchanged)
  // Fetch responses statistics
  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('is_correct, time_taken_seconds')
    .eq('attempt_id', attemptId)

  if (responsesError) {
    console.error('Responses retrieval failed:', responsesError.message)
  }

  const totalQuestions = responses?.length || 0
  const correctCount = responses?.filter((r) => r.is_correct).length || 0
  const totalDurationSeconds = responses?.reduce((acc, r) => acc + (r.time_taken_seconds || 0), 0) || 0

  // format duration
  const minutes = Math.floor(totalDurationSeconds / 60)
  const seconds = totalDurationSeconds % 60
  const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-6">
        <Card className="border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-2xl text-slate-100 p-6">
          <CardHeader className="text-center space-y-2 pb-8 border-b border-slate-800/85">
            <div className="mx-auto p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-full w-fit text-emerald-400">
              <Trophy className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-white">Assessment Completed!</CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Standard Adaptive English Level Test results
            </CardDescription>
          </CardHeader>

          <CardContent className="py-8 space-y-8">
            {/* Score and CEFR metrics badge grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Final Score</span>
                <div className="text-3xl font-extrabold text-indigo-400">{attempt.final_score}%</div>
                <span className="text-xs text-slate-500">proficiency weight</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">CEFR Level</span>
                <div className="text-3xl font-extrabold text-emerald-400">{attempt.cefr_level}</div>
                <span className="text-xs text-slate-500">standard alignment</span>
              </div>
            </div>

            {/* Detailed stats info items */}
            <div className="space-y-4 border-t border-b border-slate-800 py-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-slate-400">
                  <CheckCircle className="h-4 w-4 text-indigo-400" />
                  <span>Correct Answers</span>
                </div>
                <span className="font-semibold text-white">{correctCount} / {totalQuestions}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span>Total Time Taken</span>
                </div>
                <span className="font-semibold text-white">{durationText}</span>
              </div>
            </div>

            {/* CEFR Level description paragraph */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-200 block mb-1">CEFR Scale Level {attempt.cefr_level}:</span>
              {attempt.cefr_level === 'A1' && 'Can understand and use familiar everyday expressions and very basic phrases.'}
              {attempt.cefr_level === 'A2' && 'Can understand sentences and frequently used expressions related to areas of most immediate relevance.'}
              {attempt.cefr_level === 'B1' && 'Can understand the main points of clear standard input on familiar matters regularly encountered.'}
              {attempt.cefr_level === 'B2' && 'Can understand the main ideas of complex text on both concrete and abstract topics.'}
              {attempt.cefr_level === 'C1' && 'Can understand a wide range of demanding, longer texts, and recognise implicit meaning.'}
              {attempt.cefr_level === 'C2' && 'Can understand with ease practically everything heard or read.'}
            </div>
          </CardContent>

          <CardFooter className="pt-4 flex gap-4">
            <Link 
              href="/dashboard" 
              className={buttonVariants({ 
                className: "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition py-5 rounded-xl flex items-center justify-center space-x-2" 
              })}
            >
              <Home className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
