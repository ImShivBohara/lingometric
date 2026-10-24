import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WritingPlayer from '@/features/writing/components/WritingPlayer'
import { enforceAttemptPlayerAccess } from '@/features/testing/attemptAccess'
import { Attempt } from '@/types/database.types'

interface PageProps {
  params: Promise<{ attemptId: string }>
}

export default async function WritingAttemptPage({ params }: PageProps) {
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

  enforceAttemptPlayerAccess(attempt as Attempt, 'Writing')

  // Fetch the section metadata matching the active test context and Writing type
  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id')
    .eq('test_id', attempt.test_id)
    .eq('type', 'Writing')
    .single()

  if (sectionError || !section) {
    console.error('Failed to locate Writing section:', sectionError?.message)
    redirect('/dashboard')
  }

  // Fetch active Writing prompt belonging to the section
  const { data: prompt, error: promptError } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('section_id', section.id)
    .eq('is_active', true)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to load Writing prompt:', promptError?.message)
    redirect('/dashboard')
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <WritingPlayer 
        attemptId={attemptId} 
        prompt={{
          id: prompt.id,
          prompt_text: prompt.prompt_text,
          minimum_words: prompt.minimum_words || 100,
          maximum_words: prompt.maximum_words || 400,
        }} 
      />
    </div>
  )
}
