import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SpeakingPlayer from '@/features/speaking/components/SpeakingPlayer'
import { enforceAttemptPlayerAccess } from '@/features/testing/attemptAccess'
import { Attempt } from '@/types/database.types'

interface PageProps {
  params: Promise<{ attemptId: string }>
}

export default async function SpeakingAttemptPage({ params }: PageProps) {
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

  enforceAttemptPlayerAccess(attempt as Attempt, 'Speaking')

  // 3. Fetch the Speaking section matching the active test context
  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id')
    .eq('test_id', attempt.test_id)
    .eq('type', 'Speaking')
    .single()

  if (sectionError || !section) {
    console.error('Failed to locate Speaking section:', sectionError?.message)
    redirect('/dashboard')
  }

  // 4. Fetch the Speaking prompt belonging to this section
  const { data: prompt, error: promptError } = await supabase
    .from('speaking_prompts')
    .select('*')
    .eq('section_id', section.id)
    .eq('is_active', true)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to load Speaking prompt:', promptError?.message)
    redirect('/dashboard')
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <SpeakingPlayer 
        attemptId={attemptId} 
        prompt={{
          id: prompt.id,
          prompt_text: prompt.prompt_text,
          expected_duration_seconds: prompt.expected_duration_seconds || 60,
          difficulty_level: prompt.difficulty_level || 'B1',
        }} 
      />
    </div>
  )
}
