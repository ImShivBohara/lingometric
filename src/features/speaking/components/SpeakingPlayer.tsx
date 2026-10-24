'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  BookOpen
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitSpeakingAction } from '../actions'

interface SpeakingPlayerProps {
  attemptId: string
  prompt: {
    id: string
    prompt_text: string
    expected_duration_seconds: number
    difficulty_level: string
  }
}

const PULSE_BARS = [14, 28, 20, 36, 10, 24, 32, 16, 30, 18, 34, 12, 26, 22, 38]

export default function SpeakingPlayer({ attemptId, prompt }: SpeakingPlayerProps) {
  const router = useRouter()
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Local review playback states
  const [isLocalPlaying, setIsLocalPlaying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const localAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  // Track recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  // Stop recording automatically when expected duration is reached
  useEffect(() => {
    const limit = prompt.expected_duration_seconds || 60
    if (recordingDuration >= limit && isRecording) {
      stopRecording()
      toast.info('Maximum expected duration reached. Recording stopped.')
    }
  }, [recordingDuration, isRecording, prompt.expected_duration_seconds, stopRecording])

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Audio recording is not supported in this browser.')
        return
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Negotiate optimal format supported by student device
      let options = { mimeType: 'audio/webm' }
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/ogg' }
        if (!MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: '' } // default browser codec
        }
      }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mime })
        setAudioBlob(blob)
        
        const localUrl = URL.createObjectURL(blob)
        setAudioUrl(localUrl)
        
        // Turn off microphone input streams to release hardware
        stream.getTracks().forEach((track) => track.stop())
      }

      // Start recording slices
      recorder.start(250)
      setIsRecording(true)
      setRecordingDuration(0)
    } catch (err) {
      console.error('Microphone hardware check failed:', err)
      toast.error('Microphone access denied. Please adjust browser settings.')
    }
  }

  const recordAgain = () => {
    setAudioBlob(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setRecordingDuration(0)
    setIsLocalPlaying(false)
  }

  const toggleLocalPlayback = () => {
    if (!localAudioRef.current) return
    if (isLocalPlaying) {
      localAudioRef.current.pause()
      setIsLocalPlaying(false)
    } else {
      localAudioRef.current.play()
        .then(() => setIsLocalPlaying(true))
        .catch((err) => {
          console.error('Local review playback failed:', err)
          setIsLocalPlaying(false)
        })
    }
  }

  const handleLocalAudioEnded = () => {
    setIsLocalPlaying(false)
  }

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.error('Please record your answer first.')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      
      // 1. Fetch current user ID to isolate folder paths
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error('Authentication session has expired. Please sign in again.')
        setIsSubmitting(false)
        return
      }

      // 2. Upload the recorded file to private Storage bucket 'speaking-audio'
      const mime = audioBlob.type || 'audio/webm'
      const extension = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'webm'
      const storagePath = `${user.id}/${attemptId}.${extension}`

      console.log(`Uploading student speech recording to private bucket path: ${storagePath}`)
      const { error: uploadError } = await supabase.storage
        .from('speaking-audio')
        .upload(storagePath, audioBlob, {
          contentType: mime,
          upsert: true
        })

      if (uploadError) {
        console.error('Private upload error:', uploadError.message)
        toast.error(`Recording upload failed: ${uploadError.message}`)
        setIsSubmitting(false)
        return
      }

      // 3. Invoke Server Action to run Gemini evaluation on storagePath
      const result = await submitSpeakingAction(attemptId, prompt.id, storagePath)
      
      if (result.success) {
        toast.success('Speech evaluation complete!')
        router.push(`/test/${attemptId}/results`)
      } else {
        toast.error(result.error || 'Failed to analyze speech response.')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error('Speech submit handler error:', err)
      toast.error('An unexpected error occurred.')
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col min-h-screen text-slate-100 font-sans">
      
      {/* Hidden local audio element for review playback */}
      {audioUrl && (
        <audio
          ref={localAudioRef}
          src={audioUrl}
          onEnded={handleLocalAudioEnded}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-900 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-600/15 border border-indigo-500/30 rounded-lg">
            <Mic className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              LingoMetric
            </h1>
            <p className="text-xs text-slate-500 font-medium">Speaking Evaluation Platform</p>
          </div>
        </div>

        {/* Level tag */}
        <div className="bg-slate-900 border border-slate-800 text-indigo-400 text-xs font-mono font-bold px-3 py-1 rounded-full">
          Level {prompt.difficulty_level}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-start mb-8 min-h-0">
        
        {/* Left Panel: Prompt Card */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <Card className="border-slate-900 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-6 flex flex-col h-full">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4">
              <BookOpen className="h-4 w-4" />
              <span>Speaking Prompt</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-4 leading-snug">
              Oral Expression Task
            </h2>

            <div className="flex-grow bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-slate-300 leading-relaxed text-sm overflow-y-auto whitespace-pre-wrap">
              {prompt.prompt_text}
            </div>

            <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Duration Requirements</span>
              <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500">Expected Response Duration</div>
                <div className="text-lg font-bold text-slate-300">{prompt.expected_duration_seconds} seconds</div>
              </div>
              <div className="bg-slate-950/80 border border-indigo-950 rounded-xl p-3 text-xs text-slate-400 flex items-start space-x-2.5">
                <AlertCircle className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="leading-normal font-light">
                  Speak clearly and expand your answer logically. Try to touch on all parts of the prompt. AI evaluation evaluates fluency, pronunciation, grammar, and vocabulary range.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel: Recorder Controller Card */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100 p-6 min-h-[400px] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <Mic className="h-4 w-4 text-indigo-400" />
                <span>Audio Recording Engine</span>
              </div>
              
              {/* Status indicator */}
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-slate-700 block animate-pulse" />
                <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                  {isRecording ? 'Recording Live' : audioBlob ? 'Review Mode' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Recorder Workspace */}
            <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-6">
              
              {/* Soundwaves display animation */}
              <div className="h-16 flex items-center justify-center gap-1.5 w-full my-2">
                {PULSE_BARS.map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-indigo-500 rounded-full transition-all duration-300 ${
                      isRecording 
                        ? 'animate-pulse' 
                        : isLocalPlaying 
                        ? 'bg-emerald-500 animate-pulse'
                        : 'opacity-40'
                    }`}
                    style={{
                      height: isRecording 
                        ? `${PULSE_BARS[i % PULSE_BARS.length]}px` 
                        : isLocalPlaying 
                        ? `${Math.max(6, PULSE_BARS[(i + 3) % PULSE_BARS.length] / 2)}px`
                        : '6px',
                      animationDelay: `${i * 0.04}s`
                    }}
                  />
                ))}
              </div>

              {/* Timer metrics display */}
              <div className="text-center">
                <div className="text-4xl font-extrabold font-mono tracking-widest bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  {formatTime(recordingDuration)}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1.5">
                  {isRecording ? 'Recording duration' : audioBlob ? 'Review duration' : 'Expected: 1:00'}
                </div>
              </div>

              {/* Recorder actions */}
              <div className="flex items-center justify-center gap-4">
                {!isRecording && !audioBlob && (
                  <Button
                    onClick={startRecording}
                    className="h-16 w-16 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/10 transition duration-200"
                  >
                    <Mic className="h-6 w-6 text-white" />
                  </Button>
                )}

                {isRecording && (
                  <Button
                    onClick={stopRecording}
                    className="h-16 w-16 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-full flex items-center justify-center shadow-lg transition duration-200"
                  >
                    <Square className="h-5 w-5 text-rose-500 fill-rose-500" />
                  </Button>
                )}

                {audioBlob && (
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={toggleLocalPlayback}
                      className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition duration-200 ${
                        isLocalPlaying 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      {isLocalPlaying ? (
                        <Pause className="h-5 w-5 text-white fill-white" />
                      ) : (
                        <Play className="h-5 w-5 text-emerald-400 fill-emerald-400 translate-x-0.5" />
                      )}
                    </Button>
                    <Button
                      onClick={recordAgain}
                      variant="outline"
                      className="border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900 px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 font-semibold"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Record Again</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Recorder Footer Actions */}
            <div className="border-t border-slate-900 pt-6 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !audioBlob}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/15 px-6 py-5 rounded-xl flex items-center space-x-2 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing Audio...</span>
                  </>
                ) : (
                  <>
                    <span>Submit & Evaluate</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Screen Loader when evaluating */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center space-y-6 backdrop-blur-sm">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
            <Sparkles className="h-6 w-6 text-indigo-400 absolute animate-pulse" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-white">Speech Evaluation In Progress</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Gemini is transcribing your spoken response and grading pronunciation, fluency, grammar, and vocabulary range. This may take up to 20 seconds.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
