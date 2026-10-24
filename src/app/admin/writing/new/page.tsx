import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import WritingPromptForm from '@/features/admin/components/WritingPromptForm'

export default async function NewWritingPromptPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all Writing sections to populate target section option list
  const { data: sections, error } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Writing')

  if (error || !sections || sections.length === 0) {
    console.error('Failed to load Writing sections:', error?.message)
    // Cannot proceed with creation if no Writing sections exist
    redirect('/admin/writing')
  }

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    testTitle: (sec.tests as unknown as { title: string })?.title || 'Unknown Test'
  }))

  return (
    <div className="space-y-8 max-w-4xl font-sans">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Create Writing Prompt
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Define target writing section, essay question prompt, word limits, and difficulty tier.
        </p>
      </div>

      <WritingPromptForm sections={sectionOptions} />
    </div>
  )
}
