'use client'

import React, { useEffect, useState, useRef, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  ArrowRight, 
  ArrowLeft, 
  Headphones, 
  Play, 
  Pause, 
  Clock, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { submitListeningResponseAction, submitFinalListeningAction } from '../actions'
import QuestionNavigator from '@/features/testing/components/QuestionNavigator'

export interface ListeningQuestion {
  id: string
  passage_id: string
  question_text: string
  options: unknown
  correct_answer?: string
  explanation?: string
}

export interface ListeningPassage {
  id: string
  section_id: string
  title: string
  audio_url: string
  duration_seconds: number
  transcript?: string
  difficulty_level: string
  questions: ListeningQuestion[]
}

interface ListeningPlayerProps {
  attemptId: string
  passages: ListeningPassage[]
  initialAnswers?: Record<string, string>
}

const WAVE_HEIGHTS = [14, 28, 20, 36, 10, 24, 32, 16, 30, 18, 34, 12, 26, 22, 38]

export default function ListeningPlayer({
  attemptId,
  passages,
  initialAnswers = {},
}: ListeningPlayerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Flatten all questions across all passages to simplify linear navigation
  const allQuestions = React.useMemo(() => {
    return passages.flatMap((p) => 
      p.questions.map((q) => ({
        ...q,
        passage: p // link back to its parent passage
      }))
    )
  }, [passages])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialAnswers)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Audio Playback states
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const lastTimeRef = useRef(0)
  const [audioError, setAudioError] = useState<string | null>(null)

  const currentQuestion = allQuestions[currentIndex]
  const activePassage = currentQuestion?.passage

  // Initialize selected options if any responses already exist (or empty)
  useEffect(() => {
    // Reset timer on question change
    const timer = setTimeout(() => {
      setElapsedSeconds(0)
    }, 0)
    return () => clearTimeout(timer)
  }, [currentIndex])

  // Question timer interval
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [currentIndex])

  // Manage Audio element loading and event bindings
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPlaying(false)
      setCurrentTime(0)
      setAudioDuration(0)
      setAudioError(null)
    }, 0)
    
    lastTimeRef.current = 0
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.load()
    }
    return () => clearTimeout(timer)
  }, [activePassage?.id, activePassage?.audio_url])

  const togglePlayback = () => {
    if (!audioRef.current) return

    const audio = audioRef.current
    setAudioError(null)
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (audio.ended) {
        lastTimeRef.current = 0
        audio.currentTime = 0
      }
      audio.play()
        .then(() => { if (audioRef.current === audio) setIsPlaying(true) })
        .catch((err) => {
          if (audioRef.current !== audio || err.name === 'AbortError') return
          setAudioError('Audio could not be played. Retry or ask your administrator to check the passage audio.')
          console.error('Playback failed:', err)
          toast.error('Could not play audio. Please check your connection.')
        })
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return

    // timeupdate events can be delayed in background tabs; they are not seeks.
    if (!audioRef.current.seeking) lastTimeRef.current = audioRef.current.currentTime
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleSeeking = () => {
    const audio = audioRef.current
    if (audio && Math.abs(audio.currentTime - lastTimeRef.current) > 0.5) {
      audio.currentTime = lastTimeRef.current
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : activePassage?.duration_seconds || 0)
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    setCurrentTime(audioDuration || activePassage?.duration_seconds || 0)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Parse questions options
  const getOptionsArray = (question: typeof currentQuestion): string[] => {
    if (Array.isArray(question.options)) {
      return question.options as string[]
    }
    if (typeof question.options === 'string') {
      try {
        return JSON.parse(question.options)
      } catch {
        return []
      }
    }
    return []
  }

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion) return
    setSelectedOptions((prev) => ({
      ...prev,
      [currentQuestion.id]: option
    }))
  }

  const persistCurrentAnswer = async () => {
    if (!currentQuestion) {
      return { success: true as const }
    }

    const selectedOption = selectedOptions[currentQuestion.id]
    if (!selectedOption) {
      return { success: true as const }
    }

    return submitListeningResponseAction(
      attemptId,
      currentQuestion.id,
      selectedOption,
      Math.max(1, elapsedSeconds)
    )
  }

  const handleNavigate = (nextIndex: number) => {
    if (nextIndex === currentIndex || nextIndex < 0 || nextIndex >= allQuestions.length) {
      return
    }

    startTransition(async () => {
      const response = await persistCurrentAnswer()
      if (!response.success) {
        toast.error(response.error || 'Failed to record your answer. Please try again.')
        return
      }
      setCurrentIndex(nextIndex)
    })
  }

  const handleNext = () => {
    if (!currentQuestion) return
    const selectedOption = selectedOptions[currentQuestion.id]

    if (!selectedOption) {
      toast.error('Please select an option before proceeding.')
      return
    }

    const unansweredCount = allQuestions.filter((question) => !selectedOptions[question.id]).length
    const isLast = currentIndex === allQuestions.length - 1

    startTransition(async () => {
      const response = await persistCurrentAnswer()
      if (!response.success) {
        toast.error(response.error || 'Failed to record your answer. Please try again.')
        return
      }

      if (isLast) {
        if (unansweredCount > 0) {
          toast.error(`Answer the remaining ${unansweredCount} question${unansweredCount === 1 ? '' : 's'} before submitting.`)
          return
        }

        const result = await submitFinalListeningAction(attemptId)
        if (result.success) {
          toast.success('Listening Section completed!')
          router.push(`/test/${attemptId}/results`)
        } else {
          toast.error(result.error || 'Failed to submit final answers.')
        }
      } else {
        setCurrentIndex((prev) => prev + 1)
      }
    })
  }

  const handlePrev = () => {
    handleNavigate(currentIndex - 1)
  }

  if (!currentQuestion || !activePassage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  const progressPercent = Math.round(((currentIndex + 1) / allQuestions.length) * 100)
  const optionsArray = getOptionsArray(currentQuestion)
  const currentSelection = selectedOptions[currentQuestion.id] || ''

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col min-h-screen text-slate-100 font-sans">
      
      {/* Hidden HTML5 Audio Element */}
      <audio
        key={`${activePassage.id}:${activePassage.audio_url}`}
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false)
          setAudioError('This passage audio could not be loaded. Check your connection or ask your administrator to replace the audio file.')
        }}
        src={activePassage.audio_url}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-900 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg">
            <Headphones className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              LingoMetric
            </h1>
            <p className="text-xs text-slate-500 font-medium">Listening Assessment Module</p>
          </div>
        </div>

        {/* Live Question Timer */}
        <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-full py-1 px-3.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          <span>Time: {elapsedSeconds}s</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full my-6 overflow-hidden flex-shrink-0">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300 ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <QuestionNavigator
        total={allQuestions.length}
        currentIndex={currentIndex}
        answered={allQuestions.map((question) => Boolean(selectedOptions[question.id]))}
        onSelect={handleNavigate}
        disabled={isPending}
      />

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8 min-h-0">
        
        {/* Left Side: Audio Passage Controller Card */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <Card className="border-slate-900 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                <Headphones className="h-3.5 w-3.5" />
                Listening Passage
              </span>
              <span className="text-xs bg-slate-950/60 border border-slate-800 text-indigo-400 font-mono px-2 py-0.5 rounded">
                Tier {activePassage.difficulty_level}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2 leading-snug">
              {activePassage.title}
            </h2>

            {/* Premium Audio Dashboard controls */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-6 my-4 flex flex-col items-center justify-center space-y-4">
              
              {/* Soundwaves display representation */}
              <div className="h-12 flex items-center justify-center gap-1 w-full my-2">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-indigo-500 rounded-full transition-all duration-300 ${
                      isPlaying 
                        ? 'animate-pulse' 
                        : 'opacity-40'
                    }`}
                    style={{
                      height: isPlaying ? `${WAVE_HEIGHTS[i % WAVE_HEIGHTS.length]}px` : '6px',
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))}
              </div>

              {/* Read-only Progress Timeline Slider */}
              <div className="w-full space-y-1">
                <div className="w-full bg-slate-800 h-1.5 rounded-full relative overflow-hidden pointer-events-none">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-100"
                    style={{ width: `${(currentTime / (audioDuration || activePassage.duration_seconds || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(audioDuration || activePassage.duration_seconds)}</span>
                </div>
              </div>

              {/* Playback Buttons */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause passage audio' : 'Play passage audio'}
                  onClick={togglePlayback}
                  className={`p-4 rounded-full border shadow-md flex items-center justify-center transition duration-200 ${
                    isPlaying 
                      ? 'bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6 fill-white" />
                  ) : (
                    <Play className="h-6 w-6 fill-white translate-x-0.5" />
                  )}
                </button>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-400 font-medium">
                  {isPlaying ? 'Streaming Audio File...' : currentTime > 0 ? 'Audio Paused' : 'Ready to Play'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Play and pause are enabled. Seeking is blocked; replay is available after the audio ends.
                </p>
              </div>
            </div>

            {audioError && <div role="alert" className="rounded-xl border border-rose-500/50 p-4 text-sm text-rose-300">
              <p>{audioError}</p>
              <Button type="button" className="mt-3" onClick={() => { setAudioError(null); audioRef.current?.load() }}>Retry Audio</Button>
            </div>}
            {/* Instructions box */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 text-xs text-slate-400 flex items-start space-x-2.5">
              <AlertCircle className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="leading-normal">
                Listen to the passage narration carefully. You can answer the questions on the right panel at any time. When you finished answering all questions for this passage, click Next to continue.
              </p>
            </div>
          </Card>
        </div>

        {/* Right Side: MCQ Question Cards */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100 min-h-[400px] flex flex-col justify-between">
            <div>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">
                    Question {currentIndex + 1} of {allQuestions.length}
                  </span>
                  {currentSelection && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Answer Selected
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold text-white leading-relaxed">
                  {currentQuestion.question_text}
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs pt-1">
                  Listen to the audio details and choose the single correct choice below.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                {optionsArray.map((option, idx) => {
                  const isSelected = currentSelection === option
                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(option)}
                      disabled={isPending}
                      className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition duration-200 flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/5'
                          : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 text-slate-300 hover:text-slate-100'
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

            {/* Bottom Actions Bar */}
            <div className="p-6 border-t border-slate-900 flex justify-between items-center bg-slate-900/10">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentIndex === 0 || isPending}
                className="border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-900 font-semibold px-4 py-4 rounded-xl flex items-center space-x-1.5 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>

              <Button
                onClick={handleNext}
                disabled={isPending || !currentSelection}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/15 px-6 py-5 rounded-xl flex items-center space-x-2 transition"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {currentIndex === allQuestions.length - 1 ? 'Finish Section' : 'Next Question'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
