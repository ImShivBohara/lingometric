'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { revalidatePath } from 'next/cache'

export async function createListeningPassageAction(data: {
  title: string
  section_id: string
  audio_url: string
  duration_seconds: number
  transcript?: string
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
}) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: passage, error } = await supabase
    .from('listening_passages')
    .insert({
      title: data.title,
      section_id: data.section_id,
      audio_url: data.audio_url,
      duration_seconds: data.duration_seconds,
      transcript: data.transcript || null,
      difficulty_level: data.difficulty_level,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create passage:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/listening')
  return { success: true, data: passage }
}

export async function updateListeningPassageAction(
  passageId: string,
  data: {
    title: string
    section_id: string
    audio_url: string
    duration_seconds: number
    transcript?: string
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  }
) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: passage, error } = await supabase
    .from('listening_passages')
    .update({
      title: data.title,
      section_id: data.section_id,
      audio_url: data.audio_url,
      duration_seconds: data.duration_seconds,
      transcript: data.transcript || null,
      difficulty_level: data.difficulty_level,
    })
    .eq('id', passageId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update passage:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/listening')
  revalidatePath(`/admin/listening/${passageId}/edit`)
  return { success: true, data: passage }
}

export async function deleteListeningPassageAction(passageId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('listening_passages')
    .delete()
    .eq('id', passageId)

  if (error) {
    console.error('Failed to delete passage:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/listening')
  return { success: true }
}

export async function createListeningQuestionAction(data: {
  passage_id: string
  question_text: string
  options: string[]
  correct_answer: string
  explanation?: string
}) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: question, error } = await supabase
    .from('listening_questions')
    .insert({
      passage_id: data.passage_id,
      question_text: data.question_text,
      options: data.options,
      correct_answer: data.correct_answer,
      explanation: data.explanation || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath(`/admin/listening/${data.passage_id}/edit`)
  return { success: true, data: question }
}

export async function updateListeningQuestionAction(
  questionId: string,
  data: {
    passage_id: string
    question_text: string
    options: string[]
    correct_answer: string
    explanation?: string
  }
) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: question, error } = await supabase
    .from('listening_questions')
    .update({
      question_text: data.question_text,
      options: data.options,
      correct_answer: data.correct_answer,
      explanation: data.explanation || null,
    })
    .eq('id', questionId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath(`/admin/listening/${data.passage_id}/edit`)
  return { success: true, data: question }
}

export async function deleteListeningQuestionAction(questionId: string, passageId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('listening_questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    console.error('Failed to delete question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath(`/admin/listening/${passageId}/edit`)
  return { success: true }
}

export async function createWritingPromptAction(data: {
  section_id: string
  prompt_text: string
  minimum_words: number
  maximum_words: number
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  is_active: boolean
}) {
  await requireAdmin()
  const supabase = await createClient()

  // If set to active, deactivate all other prompts for this section first
  if (data.is_active) {
    const { error: deactivateError } = await supabase
      .from('writing_prompts')
      .update({ is_active: false })
      .eq('section_id', data.section_id)

    if (deactivateError) {
      console.error('Failed to deactivate other prompts:', deactivateError.message)
      return { success: false, error: deactivateError.message }
    }
  }

  const { data: prompt, error } = await supabase
    .from('writing_prompts')
    .insert({
      section_id: data.section_id,
      prompt_text: data.prompt_text,
      minimum_words: data.minimum_words,
      maximum_words: data.maximum_words,
      difficulty_level: data.difficulty_level,
      is_active: data.is_active,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create writing prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/writing')
  return { success: true, data: prompt }
}

export async function updateWritingPromptAction(
  promptId: string,
  data: {
    section_id: string
    prompt_text: string
    minimum_words: number
    maximum_words: number
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
    is_active: boolean
  }
) {
  await requireAdmin()
  const supabase = await createClient()

  // If set to active, deactivate all other prompts for this section first
  if (data.is_active) {
    const { error: deactivateError } = await supabase
      .from('writing_prompts')
      .update({ is_active: false })
      .eq('section_id', data.section_id)
      .neq('id', promptId)

    if (deactivateError) {
      console.error('Failed to deactivate other prompts:', deactivateError.message)
      return { success: false, error: deactivateError.message }
    }
  }

  const { data: prompt, error } = await supabase
    .from('writing_prompts')
    .update({
      section_id: data.section_id,
      prompt_text: data.prompt_text,
      minimum_words: data.minimum_words,
      maximum_words: data.maximum_words,
      difficulty_level: data.difficulty_level,
      is_active: data.is_active,
    })
    .eq('id', promptId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update writing prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/writing')
  revalidatePath(`/admin/writing/${promptId}/edit`)
  return { success: true, data: prompt }
}

export async function deleteWritingPromptAction(promptId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('writing_prompts')
    .delete()
    .eq('id', promptId)

  if (error) {
    console.error('Failed to delete writing prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/writing')
  return { success: true }
}

export async function createReadingQuestionAction(data: {
  section_id: string
  question_type: string
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  question_text: string
  options: string[]
  correct_answer: string
  explanation?: string
  category: string
}) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      section_id: data.section_id,
      question_type: data.question_type,
      difficulty_level: data.difficulty_level,
      question_text: data.question_text,
      options: data.options,
      correct_answer: data.correct_answer,
      explanation: data.explanation || null,
      category: data.category,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create reading question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reading')
  return { success: true, data: question }
}

export async function updateReadingQuestionAction(
  questionId: string,
  data: {
    section_id: string
    question_type: string
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
    question_text: string
    options: string[]
    correct_answer: string
    explanation?: string
    category: string
  }
) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: question, error } = await supabase
    .from('questions')
    .update({
      section_id: data.section_id,
      question_type: data.question_type,
      difficulty_level: data.difficulty_level,
      question_text: data.question_text,
      options: data.options,
      correct_answer: data.correct_answer,
      explanation: data.explanation || null,
      category: data.category,
    })
    .eq('id', questionId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update reading question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reading')
  revalidatePath(`/admin/reading/${questionId}/edit`)
  return { success: true, data: question }
}

export async function deleteReadingQuestionAction(questionId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    console.error('Failed to delete reading question:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reading')
  return { success: true }
}

export async function createSpeakingPromptAction(data: {
  section_id: string
  prompt_text: string
  expected_duration_seconds: number
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  is_active: boolean
}) {
  await requireAdmin()
  const supabase = await createClient()

  // If set to active, deactivate all other prompts for this section first
  if (data.is_active) {
    const { error: deactivateError } = await supabase
      .from('speaking_prompts')
      .update({ is_active: false })
      .eq('section_id', data.section_id)

    if (deactivateError) {
      console.error('Failed to deactivate other prompts:', deactivateError.message)
      return { success: false, error: deactivateError.message }
    }
  }

  const { data: prompt, error } = await supabase
    .from('speaking_prompts')
    .insert({
      section_id: data.section_id,
      prompt_text: data.prompt_text,
      expected_duration_seconds: data.expected_duration_seconds,
      difficulty_level: data.difficulty_level,
      is_active: data.is_active,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create speaking prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/speaking')
  return { success: true, data: prompt }
}

export async function updateSpeakingPromptAction(
  promptId: string,
  data: {
    section_id: string
    prompt_text: string
    expected_duration_seconds: number
    difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
    is_active: boolean
  }
) {
  await requireAdmin()
  const supabase = await createClient()

  // If set to active, deactivate all other prompts for this section first
  if (data.is_active) {
    const { error: deactivateError } = await supabase
      .from('speaking_prompts')
      .update({ is_active: false })
      .eq('section_id', data.section_id)
      .neq('id', promptId)

    if (deactivateError) {
      console.error('Failed to deactivate other prompts:', deactivateError.message)
      return { success: false, error: deactivateError.message }
    }
  }

  const { data: prompt, error } = await supabase
    .from('speaking_prompts')
    .update({
      section_id: data.section_id,
      prompt_text: data.prompt_text,
      expected_duration_seconds: data.expected_duration_seconds,
      difficulty_level: data.difficulty_level,
      is_active: data.is_active,
    })
    .eq('id', promptId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update speaking prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/speaking')
  revalidatePath(`/admin/speaking/${promptId}/edit`)
  return { success: true, data: prompt }
}

export async function deleteSpeakingPromptAction(promptId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('speaking_prompts')
    .delete()
    .eq('id', promptId)

  if (error) {
    console.error('Failed to delete speaking prompt:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/speaking')
  return { success: true }
}

