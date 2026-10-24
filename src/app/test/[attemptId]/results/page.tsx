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
  CornerDownRight,
  Info
} from 'lucide-react'
import {
  AssessmentType,
  getResumePath,
  parseAssessmentType,
  resolveAttemptSkill,
} from '@/features/testing/attemptIdentity'
import {
  CEFR_DESCRIPTORS,
  CefrLevel,
  PROVISIONAL_GRADING_DISCLAIMER,
} from '@/features/testing/cefrRating'

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

  if (attempt.status === 'DISCARDED') {
    redirect('/dashboard')
  }

  if (attempt.status !== 'SUBMITTED') {
    const resolvedType =
      parseAssessmentType(attempt.assessment_type) ?? resolveAttemptSkill(attempt)
    if (resolvedType && resolvedType !== 'Unknown') {
      redirect(getResumePath(attemptId, resolvedType as AssessmentType))
    }
    redirect('/dashboard')
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
    const cefrTier = (speakingEval.cefr_level || 'B1') as CefrLevel
    const descriptor = CEFR_DESCRIPTORS[cefrTier] || CEFR_DESCRIPTORS.B1

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
              <CardTitle className="text-2xl font-extrabold text-white">Speaking Diagnostic Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Instant AI Speech &amp; Fluency Evaluation (Provisional)
              </CardDescription>
            </CardHeader>

            <CardContent className="py-6 space-y-6">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Assessment Accuracy</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{speakingEval.overall_score}%</div>
                  <span className="text-xs text-slate-500">rubric weighted score</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Indicative CEFR</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{speakingEval.cefr_level}</div>
                  <span className="text-xs text-slate-500">provisional diagnostic tier</span>
                </div>
              </div>

              {/* Provisional Diagnostic Disclaimer */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-400">
                <Info className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{PROVISIONAL_GRADING_DISCLAIMER}</span>
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

              {/* Spoken Transcript Review */}
              {speakingEval.transcript && (
                <div className="space-y-2 border-t border-slate-800/60 pt-6">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Transcribed Speech</span>
                  <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap italic">
                    &ldquo;{speakingEval.transcript}&rdquo;
                  </div>
                </div>
              )}

              {/* Private Audio Playback */}
              {signedAudioUrl && (
                <div className="space-y-2 border-t border-slate-800/60 pt-6">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Your Audio Recording</span>
                  <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex items-center justify-center">
                    <audio controls className="w-full h-10 rounded-lg">
                      <source src={signedAudioUrl} type="audio/webm" />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                </div>
              )}

              {/* Qualitative AI Feedback */}
              <div className="space-y-6 border-t border-slate-800/60 pt-6">
                {feedback.general_feedback && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block font-mono">Speech Overview Analysis</span>
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
                      <span>Cadence &amp; Pronunciation Notes</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-rose-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {feedback.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                          <span>{w}</span>
                        </li>
                      )) || <li>No pronunciation errors detected.</li>}
                    </ul>
                  </div>
                </div>

                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      <span>Actionable Fluency Recommendations</span>
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

              {/* CEFR Level description paragraph */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-1">
                <span className="font-semibold text-slate-200 block">
                  Provisional CEFR Level {speakingEval.cefr_level} ({descriptor.name}):
                </span>
                <p>{descriptor.fullDescription}</p>
                <p className="text-[11px] text-slate-500 italic mt-1">{descriptor.provisionalNote}</p>
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
    const cefrTier = (attempt.cefr_level || 'B1') as CefrLevel
    const descriptor = CEFR_DESCRIPTORS[cefrTier] || CEFR_DESCRIPTORS.B1

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
              <CardTitle className="text-2xl font-extrabold text-white">Listening Diagnostic Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Standard Listening Diagnostic Assessment Results
              </CardDescription>
            </CardHeader>

            <CardContent className="py-8 space-y-8">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Assessment Accuracy</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{attempt.final_score}%</div>
                  <span className="text-xs text-slate-500">raw assessment score</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Indicative CEFR</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{attempt.cefr_level}</div>
                  <span className="text-xs text-slate-500">provisional diagnostic tier</span>
                </div>
              </div>

              {/* Provisional Diagnostic Disclaimer */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-400">
                <Info className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{PROVISIONAL_GRADING_DISCLAIMER}</span>
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
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-1">
                <span className="font-semibold text-slate-200 block">
                  Provisional CEFR Scale Level {attempt.cefr_level} ({descriptor.name}):
                </span>
                <p>{descriptor.fullDescription}</p>
                <p className="text-[11px] text-slate-500 italic mt-1">
                  Note: A short 3-question diagnostic evaluates targeted passage comprehension. High scores confirm solid mastery of the assessed B1 audio scenario. Higher proficiency bands (C1/C2) require extended testing across multi-speaker academic and technical registers.
                </p>
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
    const cefrTier = (writingEval.cefr_level || 'B1') as CefrLevel
    const descriptor = CEFR_DESCRIPTORS[cefrTier] || CEFR_DESCRIPTORS.B1

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
              <CardTitle className="text-2xl font-extrabold text-white">Writing Diagnostic Completed!</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Instant AI Performance Evaluation (Provisional)
              </CardDescription>
            </CardHeader>

            <CardContent className="py-6 space-y-6">
              {/* Score and CEFR metrics badge grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Assessment Accuracy</span>
                  <div className="text-3xl font-extrabold text-indigo-400">{writingEval.overall_score}%</div>
                  <span className="text-xs text-slate-500">rubric weighted score</span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Indicative CEFR</span>
                  <div className="text-3xl font-extrabold text-emerald-400">{writingEval.cefr_level}</div>
                  <span className="text-xs text-slate-500">provisional diagnostic tier</span>
                </div>
              </div>

              {/* Provisional Diagnostic Disclaimer */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-400">
                <Info className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{PROVISIONAL_GRADING_DISCLAIMER}</span>
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
                      <span>Grammar &amp; Flow Warnings</span>
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

              {/* CEFR Level description paragraph */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-1">
                <span className="font-semibold text-slate-200 block">
                  Provisional CEFR Level {writingEval.cefr_level} ({descriptor.name}):
                </span>
                <p>{descriptor.fullDescription}</p>
                <p className="text-[11px] text-slate-500 italic mt-1">{descriptor.provisionalNote}</p>
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

  // BRANCH 2: Reading Results UI
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

  const minutes = Math.floor(totalDurationSeconds / 60)
  const seconds = totalDurationSeconds % 60
  const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  const cefrTier = (attempt.cefr_level || 'B1') as CefrLevel
  const descriptor = CEFR_DESCRIPTORS[cefrTier] || CEFR_DESCRIPTORS.B1

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
            <CardTitle className="text-2xl font-extrabold text-white">Reading Diagnostic Completed!</CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Standard Reading Diagnostic Assessment Results
            </CardDescription>
          </CardHeader>

          <CardContent className="py-8 space-y-8">
            {/* Score and CEFR metrics badge grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Assessment Accuracy</span>
                <div className="text-3xl font-extrabold text-indigo-400">{attempt.final_score}%</div>
                <span className="text-xs text-slate-500">raw assessment score</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center space-y-1">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Indicative CEFR</span>
                <div className="text-3xl font-extrabold text-emerald-400">{attempt.cefr_level}</div>
                <span className="text-xs text-slate-500">provisional diagnostic tier</span>
              </div>
            </div>

            {/* Provisional Diagnostic Disclaimer */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-400">
              <Info className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <span className="leading-relaxed">{PROVISIONAL_GRADING_DISCLAIMER}</span>
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
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-1">
              <span className="font-semibold text-slate-200 block">
                Provisional CEFR Scale Level {attempt.cefr_level} ({descriptor.name}):
              </span>
              <p>{descriptor.fullDescription}</p>
              <p className="text-[11px] text-slate-500 italic mt-1">
                Note: This short diagnostic evaluates introductory to upper-intermediate comprehension (A2–B2 content). Answering all items correctly demonstrates 100% accuracy on the assessed material (B2 ceiling). Formal C1/C2 accreditation requires multi-text analytical assessments across varied disciplines.
              </p>
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
