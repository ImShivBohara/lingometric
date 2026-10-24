'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { evaluateSpeech } from '@/lib/gemini'

/**
 * Server action to download a recorded audio file from private storage,
 * evaluate it using Gemini multimodal analysis, and finalize the attempt.
 * 
 * @param attemptId Unique ID of the active test attempt
 * @param promptId Unique ID of the speaking prompt
 * @param storagePath Storage file path relative to the 'speaking-audio' bucket (e.g. "userId/attemptId.webm")
 */
export async function submitSpeakingAction(
  attemptId: string,
  promptId: string,
  storagePath: string
) {
  const supabase = await createClient()

  // 1. Get active user context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  // 2. Fetch the attempt to verify ownership and progress status
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (attemptError || !attempt) {
    console.error('Failed to locate attempt:', attemptError?.message)
    return { success: false, error: 'Failed to access test attempt' }
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return { success: false, error: 'This assessment attempt is already finalized' }
  }

  // 3. Fetch speaking prompt text for context
  const { data: prompt, error: promptError } = await supabase
    .from('speaking_prompts')
    .select('*')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to fetch speaking prompt:', promptError?.message)
    return { success: false, error: 'Speaking prompt verification failed' }
  }

  try {
    // 4. Download recording file buffer from private Supabase Storage
    console.log(`Downloading audio file from private storage path: ${storagePath}`)
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('speaking-audio')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Private audio download error:', downloadError?.message)
      return { success: false, error: 'Failed to retrieve recording from private storage' }
    }

    // 5. Convert storage file blob to Base64
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Audio = buffer.toString('base64')

    // Determine mime type from file extension
    let mimeType = 'audio/webm'
    if (storagePath.endsWith('.wav')) {
      mimeType = 'audio/wav'
    } else if (storagePath.endsWith('.ogg')) {
      mimeType = 'audio/ogg'
    } else if (storagePath.endsWith('.mp3')) {
      mimeType = 'audio/mp3'
    }

    // 6. Trigger Gemini API Multimodal evaluation
    console.log(`Evaluating audio file content via Gemini API using ${mimeType}...`)
    const evaluation = await evaluateSpeech(prompt.prompt_text, base64Audio, mimeType)

    // 7. Insert evaluation metrics into speaking_evaluations
    // We save the storagePath as the audio_url so we can securely create signed URLs for dashboard review
    const { error: insertError } = await supabase
      .from('speaking_evaluations')
      .insert({
        attempt_id: attemptId,
        audio_url: storagePath,
        transcript: evaluation.transcript,
        pronunciation_score: evaluation.pronunciation_score,
        grammar_score: evaluation.grammar_score,
        fluency_score: evaluation.fluency_score,
        vocabulary_score: evaluation.vocabulary_score,
        overall_score: evaluation.overall_score,
        cefr_level: evaluation.cefr_level,
        feedback: evaluation.feedback,
        raw_response: evaluation.raw_response,
      })

    if (insertError) {
      console.error('Failed to save speaking evaluation details:', insertError.message)
      return { success: false, error: 'Failed to save speech evaluation results' }
    }

    // 8. Update attempts table to submitted status
    const { error: attemptUpdateError } = await supabase
      .from('attempts')
      .update({
        submitted_at: new Date().toISOString(),
        final_score: evaluation.overall_score,
        cefr_level: evaluation.cefr_level,
        status: 'SUBMITTED',
      })
      .eq('id', attemptId)

    if (attemptUpdateError) {
      console.error('Failed to finalize attempt:', attemptUpdateError.message)
      return { success: false, error: 'Failed to finalize assessment status' }
    }

    // 9. Sync student current CEFR level progress
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ current_cefr_level: evaluation.cefr_level })
      .eq('id', user.id)

    if (userUpdateError) {
      console.error('Failed to sync student CEFR progress level:', userUpdateError.message)
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: unknown) {
    console.error('Speech evaluation handler failed:', err)
    const errorMsg = err instanceof Error ? err.message : 'AI speech engine is busy'
    return { success: false, error: errorMsg }
  }
}
