'use client'

import React, { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
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
  CornerDownRight
} from 'lucide-react'

// Extended attempt structure returned by Supabase joins
interface ExtendedAttempt extends Attempt {
  tests: Test | null
  writing_evaluations: WritingEvaluation[]
  listening_responses?: { id: string }[]
  speaking_evaluations?: SpeakingEvaluation[]
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

export default function AttemptsHistory({ attempts }: AttemptsHistoryProps) {
  const [activeTab, setActiveTab] = useState<'reading' | 'listening' | 'writing' | 'speaking'>('reading')
  const [selectedEval, setSelectedEval] = useState<SelectedEvalState | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Classify attempts
  const writingAttempts = attempts.filter(
    (a) => a.writing_evaluations && a.writing_evaluations.length > 0
  )
  const listeningAttempts = attempts.filter(
    (a) => a.listening_responses && a.listening_responses.length > 0
  )
  const speakingAttempts = attempts.filter(
    (a) => a.speaking_evaluations && a.speaking_evaluations.length > 0
  )
  const readingAttempts = attempts.filter(
    (a) => (!a.writing_evaluations || a.writing_evaluations.length === 0) &&
           (!a.listening_responses || a.listening_responses.length === 0) &&
           (!a.speaking_evaluations || a.speaking_evaluations.length === 0)
  )

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
      coherenceScore: evaluation.pronunciation_score || 0, // map pronunciation to coherenceScore for reused grid
      fluencyScore: evaluation.fluency_score || 0,
      overallScore: evaluation.overall_score || 0,
      cefrLevel: evaluation.cefr_level || 'B1',
      feedback: (evaluation.feedback as SelectedEvalState['feedback']) || {},
      type: 'speaking'
    })
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-slate-900 bg-slate-950/40 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('reading')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'reading'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reading History
        </button>
        <button
          onClick={() => setActiveTab('listening')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'listening'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Listening History
        </button>
        <button
          onClick={() => setActiveTab('writing')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'writing'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Writing History
        </button>
        <button
          onClick={() => setActiveTab('speaking')}
          className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
            activeTab === 'speaking'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Speaking History
        </button>
      </div>

      {/* Reading History Tab */}
      {activeTab === 'reading' && (
        <Card className="bg-slate-900/30 border-slate-900 text-white">
          <CardContent className="pt-6">
            {readingAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="font-semibold text-slate-300">No Reading attempts logged</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  You have not completed any Reading comprehension test attempts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {readingAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{attempt.tests?.title || 'English Proficiency Assessment'}</h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(attempt.started_at)}</span>
                        {attempt.status === 'IN_PROGRESS' && (
                          <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="font-bold text-indigo-400">{attempt.final_score ?? '—'}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Score</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">{attempt.cefr_level || '—'}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">CEFR</div>
                      </div>
                    </div>
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
                  You have not completed any Listening assessment attempts yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {listeningAttempts.map((attempt) => (
                  <div key={attempt.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{attempt.tests?.title || 'Listening Comprehension Assessment'}</h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(attempt.started_at)}</span>
                        {attempt.status === 'IN_PROGRESS' && (
                          <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="font-bold text-indigo-400">{attempt.final_score ?? '—'}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Score</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">{attempt.cefr_level || '—'}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">CEFR</div>
                      </div>
                    </div>
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
                {writingAttempts.map((attempt) => {
                  const evalData = attempt.writing_evaluations?.[0]
                  if (!evalData) return null

                  return (
                    <div key={attempt.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Writing Assessment</h4>
                        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="font-bold text-indigo-400">{evalData.overall_score ?? '—'}</div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider">Score</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">{evalData.cefr_level || '—'}</div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider">CEFR</div>
                        </div>
                        <Button
                          onClick={() => handleOpenFeedback(attempt, evalData)}
                          variant="ghost"
                          size="sm"
                          className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white px-3 font-semibold transition"
                        >
                          <span>View AI Feedback</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
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
                {speakingAttempts.map((attempt) => {
                  const evalData = attempt.speaking_evaluations?.[0]
                  if (!evalData) return null

                  return (
                    <div key={attempt.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Speaking Assessment</h4>
                        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(attempt.started_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="font-bold text-indigo-400">{evalData.overall_score ?? '—'}</div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider">Score</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">{evalData.cefr_level || '—'}</div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider">CEFR</div>
                        </div>
                        <Button
                          onClick={() => handleOpenSpeakingFeedback(attempt, evalData)}
                          variant="ghost"
                          size="sm"
                          className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white px-3 font-semibold transition"
                        >
                          <span>View AI Feedback</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                    CEFR: {selectedEval.cefrLevel}
                  </div>
                </div>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                  Submitted on {formatDate(selectedEval.attemptDate)}
                </DialogDescription>
              </DialogHeader>

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
