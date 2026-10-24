import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { Button } from '@/components/ui/button'
import { Plus, ClipboardList } from 'lucide-react'
import ReadingQuestionList from '@/features/admin/components/ReadingQuestionList'

export const dynamic = 'force-dynamic'

export default async function ReadingAdminListPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all reading questions, joining sections and tests, filtering by inner-join to type = 'Reading'
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_type,
      difficulty_level,
      question_text,
      options,
      correct_answer,
      explanation,
      category,
      section_id,
      sections!inner (
        id,
        name,
        type,
        tests (
          id,
          title
        )
      )
    `)
    .eq('sections.type', 'Reading')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load reading questions:', error.message)
  }

  interface DBQuestionWithSection {
    id: string
    question_type: string
    difficulty_level: string
    question_text: string
    options: unknown
    correct_answer: string
    explanation: string | null
    category: string
    section_id: string
    sections: {
      id: string
      name: string
      type: string
      tests: {
        id: string
        title: string
      } | null
    } | null
  }

  // Type assertion/transformation to match components requirements safely
  const mappedQuestions = ((questions as unknown as DBQuestionWithSection[]) || []).map((q) => ({
    id: q.id,
    question_type: q.question_type,
    difficulty_level: q.difficulty_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    category: q.category,
    section_id: q.section_id,
    sections: q.sections ? {
      id: q.sections.id,
      name: q.sections.name,
      type: q.sections.type,
      tests: q.sections.tests ? {
        id: q.sections.tests.id,
        title: q.sections.tests.title
      } : null
    } : null
  }))

  return (
    <div className="space-y-8 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-900">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Reading Question Bank
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Configure reading questions (Grammar, Vocabulary, Tenses, Sentence Completion, Comprehension) and CEFR levels.
          </p>
        </div>
        <div className="flex items-center space-x-3.5">
          <Link href="/admin/reading/assignments">
            <Button variant="outline" className="border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300 hover:text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2 transition">
              <ClipboardList className="h-4 w-4 text-indigo-400" />
              <span>Test Assignments</span>
            </Button>
          </Link>
          <Link href="/admin/reading/new">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2 shadow-lg shadow-indigo-500/10 transition">
              <Plus className="h-4 w-4" />
              <span>Create Question</span>
            </Button>
          </Link>
        </div>
      </div>

      <ReadingQuestionList initialQuestions={mappedQuestions} />

    </div>
  )
}
