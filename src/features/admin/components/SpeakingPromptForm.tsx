'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createSpeakingPromptAction, updateSpeakingPromptAction } from '../actions'

interface SectionOption {
  id: string
  name: string
  testTitle: string
}

interface SpeakingPromptFormProps {
  sections: SectionOption[]
  initialData?: {
    id: string
    section_id: string
    prompt_text: string
    expected_duration_seconds: number
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
    is_active: boolean
  }
}

export default function SpeakingPromptForm({ sections, initialData }: SpeakingPromptFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form states
  const [sectionId, setSectionId] = useState(initialData?.section_id || sections[0]?.id || '')
  const [promptText, setPromptText] = useState(initialData?.prompt_text || '')
  const [expectedDuration, setExpectedDuration] = useState(initialData?.expected_duration_seconds?.toString() || '60')
  const [difficultyLevel, setDifficultyLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>(
    initialData?.difficulty_level || 'B2'
  )
  const [isActive, setIsActive] = useState(initialData?.is_active || false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validations
    if (!sectionId) {
      toast.error('Please select a target Speaking section.')
      return
    }
    if (!promptText.trim()) {
      toast.error('Prompt text cannot be empty.')
      return
    }

    const durationNum = parseInt(expectedDuration, 10)

    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error('Expected duration must be a positive integer.')
      return
    }

    const payload = {
      section_id: sectionId,
      prompt_text: promptText.trim(),
      expected_duration_seconds: durationNum,
      difficulty_level: difficultyLevel,
      is_active: isActive
    }

    startTransition(async () => {
      let result
      if (initialData?.id) {
        result = await updateSpeakingPromptAction(initialData.id, payload)
      } else {
        result = await createSpeakingPromptAction(payload)
      }

      if (result.success) {
        toast.success(initialData?.id ? 'Speaking prompt updated successfully.' : 'Speaking prompt created successfully.')
        router.push('/admin/speaking')
        router.refresh()
      } else {
        toast.error(`Operation failed: ${result.error}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm text-slate-100">
        <CardContent className="p-6 space-y-6">
          
          {/* Target Speaking Section */}
          <div className="space-y-2">
            <Label htmlFor="section" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Target Test & Speaking Section
            </Label>
            <select
              id="section"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.testTitle} — {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Text */}
          <div className="space-y-2">
            <Label htmlFor="prompt_text" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Prompt Instructions & Topic
            </Label>
            <Textarea
              id="prompt_text"
              rows={5}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter instructions (e.g. Describe a challenge you solved at work...)"
              className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-100 text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expected Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Expected Duration (Seconds)
              </Label>
              <Input
                id="duration"
                type="number"
                value={expectedDuration}
                onChange={(e) => setExpectedDuration(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-xs rounded-xl"
              />
            </div>

            {/* CEFR Difficulty Level */}
            <div className="space-y-2">
              <Label htmlFor="difficulty" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                CEFR Difficulty Level
              </Label>
              <select
                id="difficulty"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2')}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Status Checkbox Toggle */}
          <div className="pt-4 border-t border-slate-800 flex items-center space-x-3">
            <input
              id="is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600"
            />
            <div className="space-y-0.5">
              <Label htmlFor="is_active" className="text-xs font-bold text-white cursor-pointer">
                Set Active Prompt
              </Label>
              <p className="text-[10px] text-slate-500">
                When active, this prompt will instantly be loaded by student test attempts. Note: other prompts in this section will be deactivated.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <Link href="/admin/speaking">
          <Button
            type="button"
            variant="outline"
            className="border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-200 px-4 py-2 text-xs rounded-xl flex items-center gap-2 font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </Button>
        </Link>

        <Button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-6 py-2.5 flex items-center space-x-2 shadow-lg shadow-indigo-500/10 disabled:opacity-50 transition"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span>{initialData?.id ? 'Update Prompt' : 'Create Prompt'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
