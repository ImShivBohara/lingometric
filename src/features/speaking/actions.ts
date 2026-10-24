'use server'

import { revalidatePath } from 'next/cache'
import { evaluateSpeech } from '@/lib/gemini'
import { assertModifiableAttempt, getOwnedAttempt } from '@/features/testing/attemptAccess'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

/**
 * Server action to download a recorded audio file from private storage,
 * evaluate it using Gemini multimodal analysis, and finalize the attempt.
 * The evaluation is submitted via a trusted server-only service-role client,
 * ensuring students cannot forge scores or CEFR levels.
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
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, userId, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Speaking')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // 1. Fetch speaking prompt text for context
  const { data: prompt, error: promptError } = await supabase
    .from('speaking_prompts')
    .select('id, prompt_text, section_id')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to fetch speaking prompt:', promptError?.message)
    return { success: false, error: 'Speaking prompt verification failed' }
  }

  // 2. Verify prompt belongs to this attempt's test
  const { data: section } = await supabase
    .from('sections')
    .select('id')
    .eq('id', prompt.section_id)
    .eq('test_id', attempt.test_id)
    .eq('type', 'Speaking')
    .maybeSingle()

  if (!section) {
    return { success: false, error: 'Speaking prompt does not belong to this assessment' }
  }

  try {
    // 3. Download recording file buffer from private Supabase Storage
    console.log(`Downloading audio file from private storage path: ${storagePath}`)
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('speaking-audio')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Private audio download error:', downloadError?.message)
      return { success: false, error: 'Failed to retrieve recording from private storage' }
    }

    // 4. Convert storage file blob to Base64
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

    // 5. Trigger Gemini API Multimodal evaluation
    console.log(`Evaluating audio file content via Gemini API using ${mimeType}...`)
    const evaluation = await evaluateSpeech(prompt.prompt_text, base64Audio, mimeType)

    // 6. Save evaluation and finalize attempt via trusted server-only RPC using service role client
    const serviceClient = createServiceRoleClient()
    const { error: rpcError } = await serviceClient.rpc('submit_speaking_evaluation', {
      p_attempt_id: attemptId,
      p_user_id: userId,
      p_audio_url: storagePath,
      p_transcript: evaluation.transcript,
      p_pronunciation_score: evaluation.pronunciation_score,
      p_grammar_score: evaluation.grammar_score,
      p_fluency_score: evaluation.fluency_score,
      p_vocabulary_score: evaluation.vocabulary_score,
      p_overall_score: evaluation.overall_score,
      p_cefr_level: evaluation.cefr_level,
      p_feedback: evaluation.feedback,
      p_raw_response: evaluation.raw_response,
    })

    if (rpcError) {
      console.error('Failed to submit speaking evaluation via trusted RPC:', rpcError.message)
      return { success: false, error: rpcError.message || 'Failed to save speech evaluation' }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: unknown) {
    console.error('Speech evaluation handler failed:', err)
    const errorMsg = err instanceof Error ? err.message : 'AI speech engine is busy'
    return { success: false, error: errorMsg }
  }
}
