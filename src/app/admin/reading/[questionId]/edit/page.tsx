import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import ReadingQuestionForm from '@/features/admin/components/ReadingQuestionForm'

interface PageProps {
  params: Promise<{ questionId: string }>
}

export default async function EditReadingQuestionPage({ params }: PageProps) {
  await requireAdmin()
  const { questionId } = await params
  const supabase = await createClient()

  // 1. Fetch reading question details
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (questionError || !question) {
    console.error('Failed to load reading question details:', questionError?.message)
    redirect('/admin/reading')
  }

  // 2. Fetch all Reading sections to populate dropdown
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Reading')

  if (sectionsError || !sections || sections.length === 0) {
    console.error('Failed to load Reading sections:', sectionsError?.message)
    redirect('/admin/reading')
  }

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    testTitle: (sec.tests as unknown as { title: string })?.title || 'Unknown Test'
  }))

  const mappedQuestion = {
    id: question.id,
    section_id: question.section_id,
    question_type: question.question_type,
    difficulty_level: question.difficulty_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
    question_text: question.question_text,
    options: question.options,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    category: question.category
  }

  return (
    <div className="space-y-8 max-w-4xl font-sans">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Edit Reading Question
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Modify target section, category, difficulty, passage text, choices, or correct answer.
        </p>
      </div>

      <ReadingQuestionForm sections={sectionOptions} initialData={mappedQuestion} />
    </div>
  )
}
