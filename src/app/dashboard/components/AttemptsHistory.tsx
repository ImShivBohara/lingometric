'use client'

import SessionHistory from '@/features/testing/components/SessionHistory'
import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Attempt, Test, WritingEvaluation, SpeakingEvaluation } from '@/types/database.types'
import { 
  Calendar, 
  FileText, 
  Award, 
  CheckCircle, 
  ChevronRight,
  AlertCircle,
  ThumbsUp,
  Lightbulb,
  CornerDownRight,
  Play,
  XCircle,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { discardAttemptAction } from '@/features/testing/actions'
import { resolveAttemptSkill, getResumePath, AssessmentType } from '@/features/testing/attemptIdentity'

// Extended attempt structure returned by Supabase joins
export interface ExtendedAttempt extends Attempt {
  tests: Test | null
  writing_evaluations?: WritingEvaluation[]
  listening_responses?: { id: string }[]
  speaking_evaluations?: SpeakingEvaluation[]
  responses?: { id: string }[]
}

interface AttemptsHistoryProps {
  attempts: ExtendedAttempt[]
}

interface SelectedEvalState {
  attemptId: string
  attemptDate: string
  essayText: string
  grammarScore: number
  vocabularyScore: number
  coherenceScore: number
  fluencyScore: number
  overallScore: number
  cefrLevel: string
  feedback: {
    strengths?: string[]
    weaknesses?: string[]
    suggestions?: string[]
    general_feedback?: string
  }
  type?: 'writing' | 'speaking'
}

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('en-CA').format(new Date(dateString))
}

export default function AttemptsHistory({ attempts: allAttempts }: AttemptsHistoryProps) {
  const attempts = allAttempts.filter(a => !a.session_id)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'reading' | 'listening' | 'writing' | 'speaking' | 'unknown'>('all')
  const [selectedEval, setSelectedEval] = useState<SelectedEvalState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [discardAttemptId, setDiscardAttemptId] = useState<string | null>(null)
  const [pendingAttemptId, setPendingAttemptId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Classify attempts using the unified, evidence-based skill resolver
  const writingAttempts = attempts.filter((a) => resolveAttemptSkill(a) === 'Writing')
  const listeningAttempts = attempts.filter((a) => resolveAttemptSkill(a) === 'Listening')
  const speakingAttempts = attempts.filter((a) => resolveAttemptSkill(a) === 'Speaking')
  const readingAttempts = attempts.filter((a) => resolveAttemptSkill(a) === 'Reading')
  const unknownAttempts = attempts.filter((a) => resolveAttemptSkill(a) === 'Unknown')

  const handleOpenFeedback = (attempt: ExtendedAttempt, evaluation: WritingEvaluation) => {
    setSelectedEval({
      attemptId: attempt.id,
      attemptDate: attempt.submitted_at || attempt.started_at,
      essayText: evaluation.essay_text,
      grammarScore: evaluation.grammar_score || 0,
      vocabularyScore: evaluation.vocabulary_score || 0,
      coherenceScore: evaluation.coherence_score || 0,
      fluencyScore: evaluation.fluency_score || 0,
      overallScore: evaluation.overall_score || 0,
      cefrLevel: evaluation.cefr_level || 'B1',
      feedback: (evaluation.feedback as SelectedEvalState['feedback']) || {},
      type: 'writing'
    })
    setIsModalOpen(true)
  }

  const handleOpenSpeakingFeedback = (attempt: ExtendedAttempt, evaluation: SpeakingEvaluation) => {
    setSelectedEval({
      attemptId: attempt.id,
      attemptDate: attempt.submitted_at || attempt.started_at,
      essayText: evaluation.transcript || '',
      grammarScore: evaluation.grammar_score || 0,
      vocabularyScore: evaluation.vocabulary_score || 0,
      coherenceScore: evaluation.pronunciation_score || 0,
      fluencyScore: evaluation.fluency_score || 0,
      overallScore: evaluation.overall_score || 0,
      cefrLevel: evaluation.cefr_level || 'B1',
      feedback: (evaluation.feedback as SelectedEvalState['feedback']) || {},
      type: 'speaking'
    })
    setIsModalOpen(true)
  }

  const handleResume = (attempt: ExtendedAttempt) => {
    const skill = resolveAttemptSkill(attempt)
    if (skill === 'Unknown') {
      toast.error('This attempt has an unknown assessment type and cannot be resumed.')
      return
    }
    router.push(getResumePath(attempt.id, skill as AssessmentType))
  }

  const handleConfirmDiscard = (attemptId: string) => {
    setPendingAttemptId(attemptId)
    startTransition(async () => {
      const result = await discardAttemptAction(attemptId)
      setPendingAttemptId(null)
      setDiscardAttemptId(null)
      if (result.success) {
        toast.success('Assessment attempt discarded.')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to discard attempt.')
      }
    })
  }

  const renderStatusBadge = (attempt: ExtendedAttempt) => {
    const skill = resolveAttemptSkill(attempt)
    return (
      <div className="flex items-center gap-2">
        {attempt.status === 'IN_PROGRESS' && (
          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            In Progress
          </span>
        )}
        {attempt.status === 'SUBMITTED' && (
          <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Submitted
          </span>
        )}
        {attempt.status === 'DISCARDED' && (
          <span className="text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Discarded
          </span>
        )}
        {skill === 'Unknown' && (
          <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Unknown Skill
          </span>
        )}
      </div>
    )
  }

  const renderScoreAndActions = (attempt: ExtendedAttempt, skill: AssessmentType | 'Unknown') => {
    const isSubmitted = attempt.status === 'SUBMITTED'
    const isInProgress = attempt.status === 'IN_PROGRESS'
    const isActionPending = isPending && pendingAttemptId === attempt.id

    // Score display: 0 is a valid score and must display as '0', never 'N/A' or '—'
    const scoreDisplay = isSubmitted && attempt.final_score !== null && attempt.final_score !== undefined
      ? String(attempt.final_score)
      : '—'
    const cefrDisplay = isSubmitted && attempt.cefr_level ? attempt.cefr_level : '—'

    return (
      <div className="flex items-center space-x-6">
        <div className="text-right">
          <div className="font-bold text-indigo-400">{scoreDisplay}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Score (%)</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-emerald-400">{cefrDisplay}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Indicative CEFR</div>
        </div>

        {isInProgress && (
          <div className="flex items-center gap-2">
            {skill !== 'Unknown' && (
              <Button
                size="sm"
                onClick={() => handleResume(attempt)}
                disabled={isActionPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-sm transition"
              >
                <Play className="h-3 w-3 fill-white" />
                <span>Resume</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDiscardAttemptId(attempt.id)}
              disabled={isActionPending}
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition"
            >
              <XCircle className="h-3 w-3" />
              <span>Discard</span>
            </Button>
          </div>
        )}

        {isSubmitted && skill === 'Writing' && attempt.writing_evaluations?.[0] && (
          <Button
            onClick={() => handleOpenFeedback(attempt, attempt.writing_evaluations![0])}
            variant="ghost"
            size="sm"
            className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white px-3 font-semibold transition"
          >
            <span>View AI Feedback</span>
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        )}

        {isSubmitted && skill === 'Speaking' && attempt.speaking_evaluations?.[0] && (
          <Button
            onClick={() => handleOpenSpeakingFeedback(attempt, attempt.speaking_evaluations![0])}
            variant="ghost"
            size="sm"
            className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white px-3 font-semibold transition"
          >
            <span>View AI Feedback</span>
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        )}

        {isSubmitted && (skill === 'Reading' || skill === 'Listening') && (
          <Link
            href={`/test/${attempt.id}/results`}
            className="inline-flex items-center text-xs font-semibold bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg transition"
          >
            <span>View Results</span>
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SessionHistory attempts={allAttempts} />
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-900 bg-slate-950/40 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('all')} className={`px-5 py-2 text-xs font-bold rounded-lg ${activeTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>All Skill History ({attempts.length})</button>
        <button
          onClick={() => setActiveTab('reading')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'reading'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reading History ({readingAttempts.length})
        </button>
        <button
          onClick={() => setActiveTab('listening')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'listening'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Listening History ({listeningAttempts.length})
        </button>
        <button
          onClick={() => setActiveTab('writing')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'writing'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Writing History ({writingAttempts.length})
        </button>
        <button
          onClick={() => setActiveTab('speaking')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'speaking'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Speaking History ({speakingAttempts.length})
        </button>
        {unknownAttempts.length > 0 && (
          <button
            onClick={() => setActiveTab('unknown')}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
              activeTab === 'unknown'
                ? 'bg-rose-600 text-white shadow'
                : 'text-rose-400/80 hover:text-rose-300'
            }`}
          >
            Unclassified ({unknownAttempts.length})
          </button>
        )}
      </div>

      {/* Reading History Tab */}
      {activeTab === 'all' && <div className="space-y-3">
        {attempts.length === 0 && <p className="text-sm text-slate-400">No individual skill attempts yet.</p>}
        {attempts.map(attempt => <Card key={attempt.id} className="border-slate-800 bg-slate-900/50 p-4 text-slate-200">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-0">
            <div><p className="font-bold">{resolveAttemptSkill(attempt)} · {attempt.tests?.title || 'Assessment'}</p>
              <p className="text-xs text-slate-400">{formatDate(attempt.started_at)}</p>{renderStatusBadge(attempt)}</div>
            {renderScoreAndActions(attempt, resolveAttemptSkill(attempt))}
          </CardContent>
        </Card>)}
      </div>}
      {activeTab === 'reading' && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            {readingAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="font-semibold text-slate-300">No Reading attempts logged</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  You have not started or completed any Reading comprehension test attempts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {readingAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">{attempt.tests?.title || 'Reading Comprehension Assessment'}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </span>
                        {renderStatusBadge(attempt)}
                      </div>
                    </div>
                    {renderScoreAndActions(attempt, 'Reading')}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Listening History Tab */}
      {activeTab === 'listening' && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            {listeningAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="font-semibold text-slate-300">No Listening attempts logged</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  You have not started or completed any Listening assessment attempts yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {listeningAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">{attempt.tests?.title || 'Listening Comprehension Assessment'}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </span>
                        {renderStatusBadge(attempt)}
                      </div>
                    </div>
                    {renderScoreAndActions(attempt, 'Listening')}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Writing History Tab */}
      {activeTab === 'writing' && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            {writingAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="font-semibold text-slate-300">No Writing attempts logged</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  Submit an essay to begin tracking your AI evaluated writing scores.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {writingAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">Writing Assessment</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </span>
                        {renderStatusBadge(attempt)}
                      </div>
                    </div>
                    {renderScoreAndActions(attempt, 'Writing')}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Speaking History Tab */}
      {activeTab === 'speaking' && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            {speakingAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="font-semibold text-slate-300">No Speaking attempts logged</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  Record your voice to begin tracking your AI evaluated speaking scores.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {speakingAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">Speaking Assessment</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </span>
                        {renderStatusBadge(attempt)}
                      </div>
                    </div>
                    {renderScoreAndActions(attempt, 'Speaking')}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unclassified / Unknown History Tab */}
      {activeTab === 'unknown' && unknownAttempts.length > 0 && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                These legacy records do not have sufficient recorded evidence to verify their skill type. They are kept safe for auditing and cannot be resumed.
              </span>
            </div>
            <div className="divide-y divide-slate-850">
              {unknownAttempts.map((attempt) => (
                <div key={attempt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-slate-300">Unclassified Legacy Assessment</h4>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(attempt.started_at)}</span>
                      </span>
                      {renderStatusBadge(attempt)}
                    </div>
                  </div>
                  {renderScoreAndActions(attempt, 'Unknown')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provisional Diagnostic Disclaimer Note */}
      <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <span>
          Provisional Diagnostic Scores: Module results reflect indicative skill performance and do not constitute formal, accredited CEFR certificates.
        </span>
      </div>

      {/* Discard Confirmation Dialog */}
      <Dialog open={Boolean(discardAttemptId)} onOpenChange={(open) => !open && setDiscardAttemptId(null)}>
        <DialogContent className="max-w-md bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Discard Assessment Attempt?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm pt-2">
              Are you sure you want to discard this unfinished assessment? It will be marked as discarded and you can start a fresh attempt. Existing recorded progress will be retained for history but will not count toward completed scores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardAttemptId(null)}
              disabled={isPending}
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => discardAttemptId && handleConfirmDiscard(discardAttemptId)}
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isPending ? 'Discarding...' : 'Yes, Discard'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Feedback Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl bg-slate-900 border border-slate-800 text-slate-100 p-6 overflow-y-auto max-h-[85vh] rounded-2xl shadow-2xl">
          {selectedEval && (
            <div className="space-y-6">
              
              {/* Header */}
              <DialogHeader className="border-b border-slate-800 pb-4">
                <div className="flex justify-between items-center pr-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                      <Award className="h-5 w-5" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white">
                      {selectedEval.type === 'speaking' ? 'Speaking Performance Evaluation' : 'Writing Performance Evaluation'}
                    </DialogTitle>
                  </div>
                  <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold font-mono">
                    Indicative CEFR: {selectedEval.cefrLevel}
                  </div>
                </div>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                  Submitted on {formatDate(selectedEval.attemptDate)} • Provisional assessment evaluation
                </DialogDescription>
              </DialogHeader>

              {/* Provisional Note */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 leading-relaxed">
                Provisional Diagnostic: Scores reflect an indicative performance rating on this module and do not represent formal institutional certification.
              </div>

              {/* Score breakdown metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Grammar</div>
                  <div className="text-xl font-extrabold text-indigo-400 mt-1">{selectedEval.grammarScore}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Vocabulary</div>
                  <div className="text-xl font-extrabold text-blue-400 mt-1">{selectedEval.vocabularyScore}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    {selectedEval.type === 'speaking' ? 'Pronunciation' : 'Coherence'}
                  </div>
                  <div className="text-xl font-extrabold text-purple-400 mt-1">{selectedEval.coherenceScore}</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Fluency</div>
                  <div className="text-xl font-extrabold text-emerald-400 mt-1">{selectedEval.fluencyScore}</div>
                </div>
              </div>

              {/* Essay content dropdown or scrollbox */}
              <div className="space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  {selectedEval.type === 'speaking' ? 'Spoken Transcript' : 'Your Essay Submission'}
                </span>
                <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedEval.essayText}
                </div>
              </div>

              {/* AI Diagnostic report feedback blocks */}
              <div className="space-y-4">
                
                {/* General Feedback overview */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Overview Analysis</span>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-850/40 rounded-xl p-4">
                    {selectedEval.feedback.general_feedback || 'No review feedback details available.'}
                  </p>
                </div>

                {/* Strengths & Weaknesses split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Key Strengths</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-emerald-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {selectedEval.feedback.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      )) || <li>No analysis registered.</li>}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Grammar & flow warnings</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-rose-950/30 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      {selectedEval.feedback.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                          <span>{w}</span>
                        </li>
                      )) || <li>No grammar errors detected.</li>}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                {selectedEval.feedback.suggestions && selectedEval.feedback.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      <span>Actionable Rephrasing Suggestions</span>
                    </span>
                    <ul className="bg-slate-950/30 border border-amber-950/30 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
                      {selectedEval.feedback.suggestions.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CornerDownRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
