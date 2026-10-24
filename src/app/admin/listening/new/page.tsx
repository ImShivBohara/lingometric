import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import PassageForm from '@/features/admin/components/PassageForm'

export default async function NewListeningPassagePage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all Listening sections to populate selection dropdown
  const { data: sections, error } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Listening')

  if (error || !sections || sections.length === 0) {
    console.error('Failed to load Listening sections:', error?.message)
    // We cannot create a passage if no listening sections exist
    redirect('/admin/listening')
  }

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    testTitle: (sec.tests as unknown as { title: string })?.title || 'Unknown Test'
  }))

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Create Listening Passage
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Define the title, audio track, difficulty level, and dialogue script details.
        </p>
      </div>

      <PassageForm sections={sectionOptions} />
    </div>
  )
}
