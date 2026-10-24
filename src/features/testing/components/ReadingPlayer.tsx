'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { Question } from '@/types/database.types'
import { useTestingStore } from '../store/testingStore'
import { submitResponseAction, submitFinalAttemptAction } from '../actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight, BookOpen, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ReadingPlayerProps {
  attemptId: string
  initialQuestions: Question[]
}

export default function ReadingPlayer({ attemptId, initialQuestions }: ReadingPlayerProps) {
  const {
    questions,
    currentIndex,
    selectedOption,
    setQuestions,
    setSelectedOption,
    nextQuestion,
    reset,
  } = useTestingStore()

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Initialize store with questions
  useEffect(() => {
    setQuestions(initialQuestions)
    return () => reset()
  }, [initialQuestions, setQuestions, reset])

  // Track elapsed time for the current question
  useEffect(() => {
    // Reset timer asynchronously to avoid synchronous cascading renders warning
    const timeout = setTimeout(() => {
      setElapsedSeconds(0)
    }, 0)

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [currentIndex])

  const currentQuestion = questions[currentIndex]

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  // Parse passage if it includes comprehension layout
  const text = currentQuestion.question_text
  const passageIndex = text.indexOf('Passage:')
  const questionIndex = text.indexOf('Question:')
  let passageText = ''
  let displayQuestionText = text

  if (passageIndex !== -1 && questionIndex !== -1) {
    passageText = text.substring(passageIndex + 8, questionIndex).trim()
    displayQuestionText = text.substring(questionIndex + 9).trim()
    // Clean outer quotes from passage if present
    if (passageText.startsWith('"') && passageText.endsWith('"')) {
      passageText = passageText.substring(1, passageText.length - 1)
    }
  }

  // Safely parse JSONB options array
  let optionsArray: string[] = []
  if (Array.isArray(currentQuestion.options)) {
    optionsArray = currentQuestion.options as string[]
  } else if (currentQuestion.options && typeof currentQuestion.options === 'string') {
    try {
      optionsArray = JSON.parse(currentQuestion.options)
    } catch {
      optionsArray = []
    }
  }

  const handleNext = () => {
    if (!selectedOption) {
      toast.error('Please select an option before proceeding.')
      return
    }

    startTransition(async () => {
      const timeSpent = Math.max(1, elapsedSeconds)
      
      // 1. Submit response to server actions
      const response = await submitResponseAction(
        attemptId,
        currentQuestion.id,
        selectedOption,
        timeSpent
      )

      if (!response.success) {
        toast.error(response.error || 'Failed to submit response.')
        return
      }

      // 2. Determine if it is the last question
      const isLast = currentIndex === questions.length - 1
      if (isLast) {
        const result = await submitFinalAttemptAction(attemptId)
        if (result.success) {
          router.push(`/test/${attemptId}/results`)
        } else {
          toast.error(result.error || 'Failed to submit final assessment. Please try again.')
        }
      } else {
        nextQuestion()
      }
    })
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100)

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-screen">
      {/* Top Navigation / Progress Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          <span>Reading Section</span>
          <span className="text-slate-600">&bull;</span>
          <span>Question {currentIndex + 1} of {questions.length}</span>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          <span>Question Time: {elapsedSeconds}s</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300 ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Assessment Body - Split Panel if passage exists */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
        {passageText ? (
          /* Passage View Left Panel */
          <Card className="lg:col-span-6 border-slate-900 bg-slate-900/20 backdrop-blur-sm text-slate-100 min-h-[400px]">
            <CardHeader className="border-b border-slate-900">
              <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">Reading Passage</span>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-base leading-relaxed text-slate-300 whitespace-pre-wrap font-light">
                {passageText}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Question & Options Right Panel */}
        <Card className={`border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100 ${passageText ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-2'} min-h-[400px] flex flex-col justify-between`}>
          <div>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white leading-relaxed">
                {displayQuestionText}
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs">
                Select the single correct choice from the list below.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {optionsArray.map((option, idx) => {
                const isSelected = selectedOption === option
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedOption(option)}
                    disabled={isPending}
                    className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/5'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <span>{option}</span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                    }`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </div>

          <div className="p-6 border-t border-slate-900 flex justify-end">
            <Button
              onClick={handleNext}
              disabled={isPending || !selectedOption}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition px-6 py-5 rounded-xl flex items-center space-x-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>{currentIndex === questions.length - 1 ? 'Finish Section' : 'Next Question'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
