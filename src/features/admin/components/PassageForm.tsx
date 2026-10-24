'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  UploadCloud, 
  CheckCircle, 
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createListeningPassageAction, updateListeningPassageAction } from '../actions'

interface ListeningSectionOption {
  id: string
  name: string
  testTitle: string
}

interface PassageFormProps {
  sections: ListeningSectionOption[]
  initialData?: {
    id: string
    title: string
    section_id: string
    audio_url: string
    duration_seconds: number
    transcript: string | null
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  }
}

export default function PassageForm({ sections, initialData }: PassageFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [title, setTitle] = useState(initialData?.title || '')
  const [sectionId, setSectionId] = useState(initialData?.section_id || (sections[0]?.id || ''))
  const [difficultyLevel, setDifficultyLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>(initialData?.difficulty_level || 'B1')
  const [transcript, setTranscript] = useState(initialData?.transcript || '')
  const [durationSeconds, setDurationSeconds] = useState(initialData?.duration_seconds || 60)
  const [audioUrl, setAudioUrl] = useState(initialData?.audio_url || '')
  
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload a valid audio file (MP3/WAV/M4A).')
      return
    }

    setIsUploading(true)
    try {
      const supabase = createClient()
      
      // Generate clean filename
      const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const storagePath = `passages/${cleanName}`

      const { error: uploadError } = await supabase.storage
        .from('listening-audio')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: { publicUrl: loadedUrl } } = supabase.storage
        .from('listening-audio')
        .getPublicUrl(storagePath)

      setAudioUrl(loadedUrl)
      
      // Auto-populate duration if audio file supports it
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const fileReader = new FileReader()
      fileReader.onload = async () => {
        try {
          const buffer = fileReader.result as ArrayBuffer
          const decoded = await audioCtx.decodeAudioData(buffer)
          setDurationSeconds(Math.round(decoded.duration))
        } catch {
          // ignore parsing duration fallback
        }
      }
      fileReader.readAsArrayBuffer(file)

      toast.success('Audio file uploaded successfully!')
    } catch (err: unknown) {
      console.error('Audio upload failed:', err)
      const errMsg = err instanceof Error ? err.message : String(err)
      toast.error(`Audio upload failed: ${errMsg}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Please provide a passage title.')
      return
    }
    if (!audioUrl.trim()) {
      toast.error('Please upload an audio file or provide a public audio URL.')
      return
    }
    if (durationSeconds <= 0) {
      toast.error('Please provide a valid audio duration.')
      return
    }

    setIsSaving(true)
    try {
      const data = {
        title,
        section_id: sectionId,
        audio_url: audioUrl,
        duration_seconds: durationSeconds,
        transcript: transcript || undefined,
        difficulty_level: difficultyLevel
      }

      if (isEdit && initialData) {
        const res = await updateListeningPassageAction(initialData.id, data)
        if (res.success) {
          toast.success('Passage updated successfully!')
          router.push('/admin/listening')
        } else {
          toast.error(res.error || 'Failed to update passage.')
        }
      } else {
        const res = await createListeningPassageAction(data)
        if (res.success && res.data) {
          toast.success('Passage created successfully!')
          router.push(`/admin/listening/${res.data.id}/edit`)
        } else {
          toast.error(res.error || 'Failed to create passage.')
        }
      }
    } catch (err) {
      console.error('Submit failed:', err)
      toast.error('An unexpected error occurred while saving.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100">
        <CardContent className="p-6 space-y-6">
          
          {/* First Row: Title & Section select */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Passage Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Natural Habitats and Eco-Systems"
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Target Listening Section
              </label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id} className="bg-slate-950">
                    {sec.testTitle} — {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Second Row: Difficulty & Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Difficulty CEFR Level
              </label>
              <select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2')}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                  <option key={lvl} value={lvl} className="bg-slate-950">
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Expected Duration (seconds)
              </label>
              <input
                type="number"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Audio Upload Panel */}
          <div className="space-y-2 border-t border-slate-800/60 pt-6">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Audio File Track (MP3)
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* File drop area */}
              <div className="md:col-span-5">
                <label className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition text-center min-h-[120px]">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <>
                      <Loader2 className="h-6 w-6 text-indigo-400 animate-spin mb-2" />
                      <span className="text-xs text-slate-400">Uploading File...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-6 w-6 text-indigo-400 mb-2" />
                      <span className="text-xs font-bold text-slate-300">Choose MP3 Audio File</span>
                      <span className="text-[10px] text-slate-500 mt-1">Accepts audio format up to 10MB</span>
                    </>
                  )}
                </label>
              </div>

              {/* Text Input URL Area */}
              <div className="md:col-span-7 space-y-2">
                <div className="text-center md:text-left text-xs font-bold text-slate-500 uppercase">
                  Or Paste Public URL
                </div>
                <input
                  type="text"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://yourbucket.supabase.co/storage/v1/object/public/..."
                  className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                />

                {audioUrl && (
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 flex items-center space-x-3 text-xs text-slate-400">
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="truncate">Active URL: {audioUrl}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transcript Textarea */}
          <div className="space-y-2 border-t border-slate-800/60 pt-6">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Audio Script / Transcript
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              placeholder="Provide the complete spoken dialogue or script of the audio passage..."
              className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-700 leading-relaxed font-sans"
            />
          </div>

          {/* Submit Trigger Buttons */}
          <div className="flex justify-end space-x-4 border-t border-slate-800/60 pt-6">
            <Button
              type="button"
              onClick={() => router.push('/admin/listening')}
              variant="outline"
              className="border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900 rounded-xl font-semibold text-xs px-5 py-3"
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={isSaving || isUploading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEdit ? 'Update Passage' : 'Create Passage & Continue'}</span>
                </>
              )}
            </Button>
          </div>

        </CardContent>
      </Card>
    </form>
  )
}
