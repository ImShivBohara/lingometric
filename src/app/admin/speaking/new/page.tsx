import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import SpeakingPromptForm from '@/features/admin/components/SpeakingPromptForm'

export default async function NewSpeakingPromptPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all Speaking sections to populate target section option list
  const { data: sections, error } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Speaking')

  if (error || !sections || sections.length === 0) {
    console.error('Failed to load Speaking sections:', error?.message)
    // Cannot proceed with creation if no Speaking sections exist
    redirect('/admin/speaking')
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
          Create Speaking Prompt
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Define target speaking section, prompt question text, expected duration, and difficulty tier.
        </p>
      </div>

      <SpeakingPromptForm sections={sectionOptions} />
    </div>
  )
}
