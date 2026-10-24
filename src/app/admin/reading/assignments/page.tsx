import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import ReadingAssignmentsManager from '@/features/admin/components/ReadingAssignmentsManager'

export const dynamic = 'force-dynamic'

export default async function ReadingAssignmentsPage() {
  // 1. Guard route for admin access only
  await requireAdmin()
  const supabase = await createClient()

  // 2. Fetch all configured tests
  const { data: tests, error: testsError } = await supabase
    .from('tests')
    .select('id, title, status')
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('Failed to load tests for assignments panel:', testsError.message)
  }

  // 3. Fetch all Reading questions
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      category,
      difficulty_level,
      sections!inner (
        type
      )
    `)
    .eq('sections.type', 'Reading')
    .order('created_at', { ascending: false })

  if (questionsError) {
    console.error('Failed to load questions for assignments panel:', questionsError.message)
  }

  // 4. Fetch all existing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('test_reading_questions')
    .select('test_id, question_id, display_order, is_active')

  if (assignmentsError) {
    console.error('Failed to load existing assignments:', assignmentsError.message)
  }

  interface DBQuestionQuery {
    id: string
    question_text: string
    category: string
    difficulty_level: string
    sections: {
      type: string
    } | null
  }

  // Map questions safely to ignore inner joined properties for the manager component
  const mappedQuestions = ((questions as unknown as DBQuestionQuery[]) || []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    category: q.category,
    difficulty_level: q.difficulty_level
  }))

  return (
    <ReadingAssignmentsManager
      tests={tests || []}
      questions={mappedQuestions}
      initialAssignments={assignments || []}
    />
  )
}
