'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { 
  Clock, 
  BookOpen, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { submitEssayAction } from '@/features/writing/actions'

interface WritingPlayerProps {
  attemptId: string
  prompt: {
    id: string
    prompt_text: string
    minimum_words: number
    maximum_words: number
  }
}

export default function WritingPlayer({ attemptId, prompt }: WritingPlayerProps) {
  const router = useRouter()
  const [essayText, setEssayText] = useState('')
  const [timeLeft, setTimeLeft] = useState(1200) // 20 minutes in seconds
  const [isSubmitting, setIsSubmitting] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ref to hold the latest essay text for the auto-submit timer callback
  const essayTextRef = useRef(essayText)
  
  useEffect(() => {
    essayTextRef.current = essayText
  }, [essayText])

  // Clean text and calculate word count
  const wordCount = essayText.trim() === '' ? 0 : essayText.trim().split(/\s+/).length
  const isWordCountValid = wordCount >= prompt.minimum_words && wordCount <= prompt.maximum_words

  // Auto-submit when time runs out (ignores word count constraint validation, submits whatever is there)
  const handleAutoSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const response = await submitEssayAction(attemptId, prompt.id, essayTextRef.current)
      if (response.success) {
        localStorage.removeItem(`writing_draft_${attemptId}`)
        router.push(`/test/${attemptId}/results`)
      } else {
        toast.error(response.error || 'Failed to submit essay')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('An unexpected error occurred during submission.')
      setIsSubmitting(false)
    }
  }, [attemptId, prompt.id, router])

  // 1. Mount & load draft
  useEffect(() => {
    const savedDraft = localStorage.getItem(`writing_draft_${attemptId}`)
    if (savedDraft) {
      // Defer state update to avoid synchronous state changes within effect body warnings
      setTimeout(() => {
        setEssayText(savedDraft)
      }, 0)
      toast.success('Restored your draft essay successfully.')
    }
  }, [attemptId])

  // 2. Autosave draft on text change
  useEffect(() => {
    if (essayText) {
      localStorage.setItem(`writing_draft_${attemptId}`, essayText)
    }
  }, [essayText, attemptId])

  // 3. Timer Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          // Trigger auto submit when timer expires
          toast.warning('Time is up! Submitting your essay automatically.')
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [handleAutoSubmit])

  // Manual submission (validates word count)
  const handleManualSubmit = async () => {
    if (wordCount < prompt.minimum_words) {
      toast.error(`Your essay is too short. Please write at least ${prompt.minimum_words} words.`)
      return
    }
    if (wordCount > prompt.maximum_words) {
      toast.error(`Your essay exceeds the limit. Please keep it under ${prompt.maximum_words} words.`)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await submitEssayAction(attemptId, prompt.id, essayText)
      if (response.success) {
        localStorage.removeItem(`writing_draft_${attemptId}`)
        toast.success('Essay submitted successfully. AI evaluation complete!')
        router.push(`/test/${attemptId}/results`)
      } else {
        toast.error(response.error || 'Failed to submit essay')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('An unexpected error occurred during submission.')
      setIsSubmitting(false)
    }
  }

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Progress percentage of timer
  const timerPercentage = (timeLeft / 1200) * 100

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col h-screen overflow-hidden text-slate-100 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-900 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              LingoMetric
            </h1>
            <p className="text-xs text-slate-500 font-medium">Writing Evaluation Platform</p>
          </div>
        </div>

        {/* Timer UI */}
        <div className="flex items-center space-x-3 bg-slate-900/60 border border-slate-800 rounded-full py-1.5 px-4">
          <Clock className={`h-4 w-4 ${timeLeft < 180 ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`} />
          <span className={`font-mono text-sm font-bold tracking-wider ${timeLeft < 180 ? 'text-rose-500' : 'text-slate-200'}`}>
            {formatTime(timeLeft)}
          </span>
          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${timeLeft < 180 ? 'bg-rose-500' : 'bg-indigo-500'}`}
              style={{ width: `${timerPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main split player view */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 overflow-hidden min-h-0">
        
        {/* Left Side: Prompt Card */}
        <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-1">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4 backdrop-blur-md flex flex-col h-full">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <BookOpen className="h-4 w-4" />
              <span>Writing Task</span>
            </div>

            <h2 className="text-xl font-bold text-white leading-snug">
              Essay Writing Prompt
            </h2>

            <div className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-slate-300 leading-relaxed text-sm overflow-y-auto whitespace-pre-wrap">
              {prompt.prompt_text}
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Submission Limits</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500">Minimum Word Count</div>
                  <div className="text-lg font-bold text-slate-300">{prompt.minimum_words} words</div>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500">Maximum Word Count</div>
                  <div className="text-lg font-bold text-slate-300">{prompt.maximum_words} words</div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-indigo-950 rounded-xl p-3 text-xs text-slate-400 flex items-start space-x-2.5">
                <AlertCircle className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="leading-normal">
                  Write a comprehensive, structured essay discussing the prompt. AI evaluation evaluates grammar precision, vocabulary diversity, coherence of flow, and fluency.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Text Editor Sheet */}
        <div className="lg:col-span-7 flex flex-col space-y-4 overflow-hidden h-full">
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl flex flex-col h-full overflow-hidden backdrop-blur-md">
            
            {/* Editor Top Bar Info */}
            <div className="bg-slate-900/60 px-6 py-4 flex items-center justify-between border-b border-slate-900 flex-shrink-0">
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span>Text Editor</span>
              </div>

              {/* Live Status Indicators */}
              <div className="flex items-center space-x-4">
                {essayText.trim().length > 0 && (
                  <span className="text-xs font-mono text-slate-500">
                    Draft Autosaved
                  </span>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-medium">Word Count:</span>
                  <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono transition-colors ${
                    isWordCountValid 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : wordCount > 0 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isWordCountValid ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-400" />
                    )}
                    <span>{wordCount} words</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Sheet */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
              <Textarea 
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                placeholder="Type your response essay here..."
                className="flex-1 w-full resize-none font-sans leading-relaxed text-sm bg-transparent border-0 focus:ring-0 focus:border-0 focus:outline-none focus-visible:ring-0 focus-visible:border-0 rounded-none p-0 overflow-y-auto"
                disabled={isSubmitting}
              />
            </div>

            {/* Editor Footer Actions */}
            <div className="bg-slate-900/40 border-t border-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="text-xs text-slate-500">
                Word bounds: {prompt.minimum_words}–{prompt.maximum_words}
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/20 px-6 flex items-center space-x-2 transition duration-200"
              >
                <span>Submit Essay</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Submitting Loader */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center space-y-6 backdrop-blur-sm">
          <div className="relative flex items-center justify-center">
            {/* Spinning gradient ring */}
            <div className="h-16 w-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
            <Sparkles className="h-6 w-6 text-indigo-400 absolute animate-pulse" />
          </div>
          
          <div className="text-center space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-white">AI Evaluation In Progress</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Advanced AI models are scoring your vocabulary range, grammar, and coherence against standard CEFR rubrics. This may take up to 20 seconds.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
