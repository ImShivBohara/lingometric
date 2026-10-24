import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import WritingPromptForm from '@/features/admin/components/WritingPromptForm'

interface PageProps {
  params: Promise<{ promptId: string }>
}

export default async function EditWritingPromptPage({ params }: PageProps) {
  await requireAdmin()
  const { promptId } = await params
  const supabase = await createClient()

  // 1. Fetch prompt details
  const { data: prompt, error: promptError } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to load writing prompt details:', promptError?.message)
    redirect('/admin/writing')
  }

  // 2. Fetch all Writing sections to populate target section dropdown options list
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Writing')

  if (sectionsError || !sections || sections.length === 0) {
    console.error('Failed to load Writing sections:', sectionsError?.message)
    redirect('/admin/writing')
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
    minimum_words: prompt.minimum_words,
    maximum_words: prompt.maximum_words,
    difficulty_level: prompt.difficulty_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
    is_active: prompt.is_active
  }

  return (
    <div className="space-y-8 max-w-4xl font-sans">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Edit Writing Prompt
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Modify target writing section, essay question prompt, word limits, or toggle active status.
        </p>
      </div>

      <WritingPromptForm sections={sectionOptions} initialData={mappedPrompt} />
    </div>
  )
}
