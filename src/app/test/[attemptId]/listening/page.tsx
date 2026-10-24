import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ListeningPlayer, { ListeningPassage } from '@/features/listening/components/ListeningPlayer'
import { enforceAttemptPlayerAccess } from '@/features/testing/attemptAccess'
import { Attempt } from '@/types/database.types'

interface PageProps {
  params: Promise<{ attemptId: string }>
}

export default async function ListeningAttemptPage({ params }: PageProps) {
  const { attemptId } = await params
  const supabase = await createClient()

  // 1. Get active user context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Get attempt details and verify ownership
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

  enforceAttemptPlayerAccess(attempt as Attempt, 'Listening')
  // 3. Fetch Listening passages assigned to the active test
  let passages: ListeningPassage[] = []

  const { data: junctionData, error: junctionError } = await supabase
    .from('test_listening_passages')
    .select(`
      id,
      display_order,
      is_active,
      passage:listening_passages (
        id,
        section_id,
        title,
        audio_url,
        duration_seconds,
        transcript,
        difficulty_level,
        questions:listening_questions (
          id,
          passage_id,
          question_text,
          options,
          correct_answer,
          explanation
        )
      )
    `)
    .eq('test_id', attempt.test_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (junctionError) {
    console.error('Failed to query test listening assignments:', junctionError.message)
  }

  if (junctionData && junctionData.length > 0) {
    // Map data to match the expected shape of passages
    passages = junctionData
      .filter((item) => item.passage !== null)
      .map((item) => {
        const rawPassage = item.passage as unknown as {
          id: string
          section_id: string
          title: string
          audio_url: string
          duration_seconds: number
          transcript?: string | null
          difficulty_level: string
          questions?: {
            id: string
            passage_id: string
            question_text: string
            options: unknown
            correct_answer: string
            explanation?: string | null
          }[] | null
        }
        return {
          id: rawPassage.id,
          section_id: rawPassage.section_id,
          title: rawPassage.title,
          audio_url: rawPassage.audio_url,
          duration_seconds: rawPassage.duration_seconds,
          transcript: rawPassage.transcript || undefined,
          difficulty_level: rawPassage.difficulty_level,
          questions: (rawPassage.questions || []).map((q) => ({
            id: q.id,
            passage_id: q.passage_id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation || undefined
          }))
        }
      })
  }

  // 4. Fallback if no test-specific assignments are configured
  if (passages.length === 0) {
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('test_id', attempt.test_id)
      .eq('type', 'Listening')
      .single()

    if (sectionError || !section) {
      console.error('Failed to locate Listening section during fallback:', sectionError?.message)
      redirect('/dashboard')
    }

    const { data: legacyPassages, error: legacyError } = await supabase
      .from('listening_passages')
      .select(`
        id,
        section_id,
        title,
        audio_url,
        duration_seconds,
        transcript,
        difficulty_level,
        questions:listening_questions (
          id,
          passage_id,
          question_text,
          options,
          correct_answer,
          explanation
        )
      `)
      .eq('section_id', section.id)
      .order('created_at', { ascending: true })

    if (legacyError || !legacyPassages || legacyPassages.length === 0) {
      console.error('Failed to load Listening passages via fallback:', legacyError?.message)
      redirect('/dashboard')
    }

    passages = legacyPassages
  }

  const { data: savedResponses } = await supabase
    .from('listening_responses')
    .select('question_id, selected_answer')
    .eq('attempt_id', attemptId)

  const initialAnswers: Record<string, string> = {}
  for (const response of savedResponses || []) {
    initialAnswers[response.question_id] = response.selected_answer
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <ListeningPlayer 
        attemptId={attemptId} 
        passages={passages}
        initialAnswers={initialAnswers}
      />
    </div>
  )
}
