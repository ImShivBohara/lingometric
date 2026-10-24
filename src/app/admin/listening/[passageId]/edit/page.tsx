import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import PassageForm from '@/features/admin/components/PassageForm'
import QuestionManager from '@/features/admin/components/QuestionManager'

interface PageProps {
  params: Promise<{ passageId: string }>
}

export default async function EditListeningPassagePage({ params }: PageProps) {
  await requireAdmin()
  const { passageId } = await params
  const supabase = await createClient()

  // 1. Fetch passage details and its comprehension questions
  const { data: passage, error: passageError } = await supabase
    .from('listening_passages')
    .select(`
      id,
      title,
      section_id,
      audio_url,
      duration_seconds,
      transcript,
      difficulty_level,
      questions: listening_questions (
        id,
        passage_id,
        question_text,
        options,
        correct_answer,
        explanation
      )
    `)
    .eq('id', passageId)
    .single()

  if (passageError || !passage) {
    console.error('Failed to load passage details:', passageError?.message)
    redirect('/admin/listening')
  }

  // 2. Fetch all Listening sections to populate selection dropdown
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      tests (
        title
      )
    `)
    .eq('type', 'Listening')

  if (sectionsError || !sections || sections.length === 0) {
    console.error('Failed to load Listening sections:', sectionsError?.message)
    redirect('/admin/listening')
  }

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    testTitle: (sec.tests as unknown as { title: string })?.title || 'Unknown Test'
  }))

  const mappedPassage = {
    id: passage.id,
    title: passage.title,
    section_id: passage.section_id,
    audio_url: passage.audio_url,
    duration_seconds: passage.duration_seconds,
    transcript: passage.transcript,
    difficulty_level: passage.difficulty_level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  }

  return (
    <div className="space-y-12 max-w-4xl font-sans">
      
      {/* Passage Edit Block */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Edit Listening Passage
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Modify title, difficulty level, transcript script, or change the uploaded audio track.
          </p>
        </div>

        <PassageForm sections={sectionOptions} initialData={mappedPassage} />
      </div>

      {/* Dynamic Questions Manager Block */}
      <div className="border-t border-slate-800/80 pt-10">
        <QuestionManager 
          passageId={passage.id} 
          initialQuestions={passage.questions || []} 
        />
      </div>

    </div>
  )
}
