import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import SpeakingPromptForm from '@/features/admin/components/SpeakingPromptForm'

interface PageProps {
  params: Promise<{ promptId: string }>
}

export default async function EditSpeakingPromptPage({ params }: PageProps) {
  await requireAdmin()
  const { promptId } = await params
  const supabase = await createClient()

  // 1. Fetch prompt details
  const { data: prompt, error: promptError } = await supabase
    .from('speaking_prompts')
    .select('*')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to load speaking prompt details:', promptError?.message)
    redirect('/admin/speaking')
  }

  // 2. Fetch all Speaking sections to populate target section dropdown options list
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Speaking')

  if (sectionsError || !sections || sections.length === 0) {
    console.error('Failed to load Speaking sections:', sectionsError?.message)
    redirect('/admin/speaking')
  }

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    testTitle: (sec.tests as unknown as { title: string })?.title || 'Unknown Test'
  }))

  const mappedPrompt = {
    id: prompt.id,
    section_id: prompt.section_id,
    prompt_text: prompt.prompt_text,
    expected_duration_seconds: prompt.expected_duration_seconds || 60,
    difficulty_level: prompt.difficulty_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
    is_active: prompt.is_active
  }

  return (
    <div className="space-y-8 max-w-4xl font-sans">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Edit Speaking Prompt
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Modify target speaking section, prompt question text, expected duration, or toggle active status.
        </p>
      </div>

      <SpeakingPromptForm sections={sectionOptions} initialData={mappedPrompt} />
    </div>
  )
}
