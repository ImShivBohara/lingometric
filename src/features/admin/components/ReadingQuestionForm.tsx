'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createReadingQuestionAction, updateReadingQuestionAction } from '../actions'

interface SectionOption {
  id: string
  name: string
  testTitle: string
}

interface ReadingQuestionFormProps {
  sections: SectionOption[]
  initialData?: {
    id: string
    section_id: string
    question_type: string
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
    question_text: string
    options: unknown
    correct_answer: string
    explanation?: string | null
    category: string
  }
}

const CATEGORIES = [
  'Grammar',
  'Vocabulary',
  'Tenses',
  'Sentence Completion',
  'Reading Comprehension',
  'Articles',
  'Prepositions',
  'Conditionals',
  'General'
]

const DIFFICULTY_LEVELS: ('A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2')[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function ReadingQuestionForm({ sections, initialData }: ReadingQuestionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Parse passage if it includes comprehension layout
  const text = initialData?.question_text || ''
  const passageIdx = text.indexOf('Passage:')
  const questionIdx = text.indexOf('Question:')
  let initialPassage = ''
  let initialQuestionText = text
  let initialIsComprehension = false

  if (passageIdx !== -1 && questionIdx !== -1) {
    initialPassage = text.substring(passageIdx + 8, questionIdx).trim()
    initialQuestionText = text.substring(questionIdx + 9).trim()
    // Clean outer quotes from passage if present
    if (initialPassage.startsWith('"') && initialPassage.endsWith('"')) {
      initialPassage = initialPassage.substring(1, initialPassage.length - 1)
    }
    initialIsComprehension = true
  }

  const getOptionsArray = (rawOptions: unknown): string[] => {
    if (Array.isArray(rawOptions)) return rawOptions as string[]
    try {
      if (typeof rawOptions === 'string') {
        const parsed = JSON.parse(rawOptions)
        if (Array.isArray(parsed)) return parsed as string[]
      }
    } catch {
      // ignore
    }
    return []
  }

  const initialOpts = initialData ? getOptionsArray(initialData.options) : ['', '', '', '']
  const correctIdx = initialData ? initialOpts.indexOf(initialData.correct_answer) : 0

  // Form states
  const [sectionId, setSectionId] = useState(initialData?.section_id || sections[0]?.id || '')
  const [category, setCategory] = useState(initialData?.category || 'General')
  const [difficultyLevel, setDifficultyLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>(
    initialData?.difficulty_level || 'B2'
  )
  const [isComprehension, setIsComprehension] = useState(initialIsComprehension)
  const [passage, setPassage] = useState(initialPassage)
  const [questionText, setQuestionText] = useState(initialQuestionText)
  const [options, setOptions] = useState<string[]>(initialOpts.length > 0 ? initialOpts : ['', '', '', ''])
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState(correctIdx !== -1 ? correctIdx : 0)
  const [explanation, setExplanation] = useState(initialData?.explanation || '')

  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options]
    newOptions[index] = val
    setOptions(newOptions)
  }

  const handleAddOptionField = () => {
    if (options.length >= 6) {
      toast.info('Maximum 6 choices permitted.')
      return
    }
    setOptions([...options, ''])
  }

  const handleRemoveOptionField = (index: number) => {
    if (options.length <= 2) {
      toast.info('Minimum 2 choices required.')
      return
    }
    const newOptions = options.filter((_, idx) => idx !== index)
    setOptions(newOptions)
    if (selectedCorrectIndex >= newOptions.length) {
      setSelectedCorrectIndex(0)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validations
    if (!sectionId) {
      toast.error('Please select a target Reading section.')
      return
    }
    if (isComprehension && !passage.trim()) {
      toast.error('Passage text cannot be empty for comprehension questions.')
      return
    }
    if (!questionText.trim()) {
      toast.error('Question text cannot be empty.')
      return
    }

    // Check options
    const filteredOptions = options.map((opt) => opt.trim())
    if (filteredOptions.some((opt) => !opt)) {
      toast.error('All options must have content.')
      return
    }

    // Ensure correct answer index is within bounds
    if (selectedCorrectIndex < 0 || selectedCorrectIndex >= filteredOptions.length) {
      toast.error('Please select a valid correct answer choice.')
      return
    }

    const correctAnswerText = filteredOptions[selectedCorrectIndex]

    // Form final question text
    const finalQuestionText = isComprehension
      ? `Passage: "${passage.trim()}"\n\nQuestion: ${questionText.trim()}`
      : questionText.trim()

    const payload = {
      section_id: sectionId,
      question_type: 'MCQ',
      difficulty_level: difficultyLevel,
      question_text: finalQuestionText,
      options: filteredOptions,
      correct_answer: correctAnswerText,
      explanation: explanation.trim() || undefined,
      category: category,
    }

    startTransition(async () => {
      let result
      if (initialData?.id) {
        result = await updateReadingQuestionAction(initialData.id, payload)
      } else {
        result = await createReadingQuestionAction(payload)
      }

      if (result.success) {
        toast.success(initialData?.id ? 'Reading question updated successfully.' : 'Reading question created successfully.')
        router.push('/admin/reading')
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Target Reading Section */}
            <div className="space-y-2">
              <Label htmlFor="section" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Target Test & Reading Section
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

            {/* Category selection */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Category
              </Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
                {DIFFICULTY_LEVELS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comprehension toggle */}
          <div className="pt-2 flex items-center space-x-3">
            <input
              id="is_comprehension"
              type="checkbox"
              checked={isComprehension}
              onChange={(e) => {
                setIsComprehension(e.target.checked)
                if (e.target.checked && category === 'General') {
                  setCategory('Reading Comprehension')
                }
              }}
              className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600"
            />
            <div className="space-y-0.5">
              <Label htmlFor="is_comprehension" className="text-xs font-bold text-white cursor-pointer">
                Comprehension Question
              </Label>
              <p className="text-[10px] text-slate-500">
                Check this if the question is based on a reading passage/comprehension text.
              </p>
            </div>
          </div>

          {/* Passage Section if comprehension */}
          {isComprehension && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label htmlFor="passage" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Reading Passage Text
              </Label>
              <Textarea
                id="passage"
                rows={6}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Enter the passage text that students will read to answer the question..."
                className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-100 text-xs rounded-xl"
              />
            </div>
          )}

          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="question_text" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isComprehension ? 'Comprehension Question Text' : 'Question / Sentence text'}
            </Label>
            <Textarea
              id="question_text"
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={
                isComprehension
                  ? 'e.g. What is the main argument presented by the author?'
                  : 'e.g. She ____ to the cinema yesterday. (Use the correct past tense)'
              }
              className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-100 text-xs rounded-xl"
            />
          </div>

          {/* Options List */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Answer Choices
              </Label>
              {options.length < 6 && (
                <Button
                  type="button"
                  onClick={handleAddOptionField}
                  variant="outline"
                  className="h-7 border-slate-800 hover:border-slate-700 bg-slate-950 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2.5 rounded-lg flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Choice
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500 select-none">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <Input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Choice option ${idx + 1}`}
                      className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-xs rounded-xl pl-9 pr-3"
                    />
                  </div>
                  {options.length > 2 && (
                    <Button
                      type="button"
                      onClick={() => handleRemoveOptionField(idx)}
                      variant="outline"
                      className="h-9 w-9 border-slate-800 hover:border-rose-950/50 hover:bg-rose-950/10 text-slate-500 hover:text-rose-400 rounded-xl flex items-center justify-center p-0 flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Correct Answer and Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div className="space-y-2">
              <Label htmlFor="correct_choice" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Correct Answer Option
              </Label>
              <select
                id="correct_choice"
                value={selectedCorrectIndex}
                onChange={(e) => setSelectedCorrectIndex(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {options.map((_, idx) => (
                  <option key={idx} value={idx}>
                    Option {String.fromCharCode(65 + idx)} {options[idx] ? `(${options[idx].substring(0, 30)}${options[idx].length > 30 ? '...' : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="explanation" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Explanation (Optional)
              </Label>
              <Textarea
                id="explanation"
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this choice is correct..."
                className="bg-slate-950 border-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-100 text-xs rounded-xl"
              />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <Link href="/admin/reading">
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
              <span>{initialData?.id ? 'Update Question' : 'Create Question'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
