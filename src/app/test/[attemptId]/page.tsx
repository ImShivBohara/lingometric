import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReadingPlayer from '@/features/testing/components/ReadingPlayer'
import { enforceAttemptPlayerAccess } from '@/features/testing/attemptAccess'
import { Attempt, Question } from '@/types/database.types'

interface PageProps {
  params: Promise<{ attemptId: string }>
}

export default async function TestAttemptPage({ params }: PageProps) {
  const { attemptId } = await params
  const supabase = await createClient()

  // Get active user context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get attempt details and verify ownership
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (attemptError || !attempt) {
    console.error('Attempt access verification failed:', attemptError?.message)
    redirect('/dashboard')
  }

  enforceAttemptPlayerAccess(attempt as Attempt, 'Reading')

  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select('id, type')
    .eq('test_id', attempt.test_id)
    .order('display_order', { ascending: true })

  if (sectionsError || !sections || sections.length === 0) {
    console.error('Failed to locate test sections:', sectionsError?.message)
    redirect('/dashboard')
  }

  const readingSection = sections.find((s) => s.type === 'Reading')
  if (!readingSection) {
    console.error('Failed to locate Reading section for this attempt')
    redirect('/dashboard')
  }

  // 1. Fetch assigned reading questions via junction table
  const { data: assigned, error: assignedError } = await supabase
    .from('test_reading_questions')
    .select(`
      question_id,
      display_order,
      questions (
        id,
        section_id,
        question_type,
        difficulty_level,
        question_text,
        options,
        correct_answer,
        explanation,
        category,
        estimated_time_seconds,
        created_at
      )
    `)
    .eq('test_id', attempt.test_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  interface AssignedQuestionRow {
    question_id: string
    display_order: number
    questions: {
      id: string
      section_id: string
      question_type: string
      difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
      question_text: string
      options: string[] | Record<string, unknown> | null
      correct_answer: string
      explanation: string | null
      category: string
      estimated_time_seconds: number
      created_at: string;
    } | null
  }

  let questions: NonNullable<AssignedQuestionRow['questions']>[] = []

  if (!assignedError && assigned && assigned.length > 0) {
    // Extract list of questions from junction records
    const assignedData = assigned as unknown as AssignedQuestionRow[]
    questions = assignedData.map((a) => a.questions).filter((q): q is NonNullable<typeof q> => !!q)
  } else {
    // 2. Fallback to existing section-based retrieval if no custom assignments exist
    const { data: fallbackQuestions, error: fallbackError } = await supabase
      .from('questions')
      .select('*')
      .eq('section_id', readingSection.id)
      .order('created_at', { ascending: true })

    if (fallbackError || !fallbackQuestions || fallbackQuestions.length === 0) {
      console.error('Failed to load Reading questions:', fallbackError?.message)
      redirect('/dashboard')
    }
    questions = fallbackQuestions as NonNullable<AssignedQuestionRow['questions']>[]
  }

  const { data: savedResponses } = await supabase
    .from('responses')
    .select('question_id, selected_answer')
    .eq('attempt_id', attemptId)

  const initialAnswers: Record<string, string> = {}
  for (const response of savedResponses || []) {
    initialAnswers[response.question_id] = response.selected_answer
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <ReadingPlayer
        attemptId={attemptId}
        initialQuestions={questions as Question[]}
        initialAnswers={initialAnswers}
      />
    </div>
  )
}
