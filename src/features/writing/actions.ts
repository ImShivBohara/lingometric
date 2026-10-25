'use server'

import { revalidatePath } from 'next/cache'
import { evaluateEssay } from '@/lib/gemini'
import { assertModifiableAttempt, getOwnedAttempt } from '@/features/testing/attemptAccess'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { validateWritingWordCount } from './validation'

/**
 * Server action to submit an essay response and trigger AI scoring/evaluation.
 * The evaluation is submitted via a trusted server-only service-role client,
 * ensuring students cannot forge scores or CEFR levels.
 */
export async function submitEssayAction(
  attemptId: string,
  promptId: string,
  essayText: string
) {
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, userId, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Writing')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // 1. Fetch writing prompt constraints for validation
  const { data: prompt, error: promptError } = await supabase
    .from('writing_prompts')
    .select('id, prompt_text, section_id, minimum_words, maximum_words')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to fetch writing prompt:', promptError?.message)
    return { success: false, error: 'Prompt verification failed' }
  }

  // 2. Verify prompt belongs to this attempt's test
  const { data: section } = await supabase
    .from('sections')
    .select('id')
    .eq('id', prompt.section_id)
    .eq('test_id', attempt.test_id)
    .eq('type', 'Writing')
    .maybeSingle()

  if (!section) {
    return { success: false, error: 'Writing prompt does not belong to this assessment' }
  }

  // 3. Enforce word count constraints server-side before invoking AI evaluation
  const minWords = prompt.minimum_words ?? 50
  const maxWords = prompt.maximum_words ?? 500
  const validation = validateWritingWordCount(essayText, minWords, maxWords)
  console.log(`Submitting essay with ${validation.wordCount} words (allowed: ${minWords}-${maxWords}) for attempt ${attemptId}`)

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Essay does not meet the length requirements.',
    }
  }

  try {
    // 4. Trigger Gemini Evaluation
    const evaluation = await evaluateEssay(prompt.prompt_text, essayText)

    // 5. Save evaluation and finalize attempt via trusted server-only RPC using service role client
    const serviceClient = createServiceRoleClient()
    const { error: rpcError } = await serviceClient.rpc('submit_writing_evaluation', {
      p_attempt_id: attemptId,
      p_user_id: userId,
      p_essay_text: essayText,
      p_grammar_score: evaluation.grammar_score,
      p_vocabulary_score: evaluation.vocabulary_score,
      p_coherence_score: evaluation.coherence_score,
      p_fluency_score: evaluation.fluency_score,
      p_overall_score: evaluation.overall_score,
      p_cefr_level: evaluation.cefr_level,
      p_feedback: evaluation.feedback,
      p_raw_response: evaluation.raw_response,
    })

    if (rpcError) {
      console.error('Failed to submit writing evaluation via trusted RPC:', rpcError.message)
      return { success: false, error: rpcError.message || 'Failed to save essay evaluation' }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error'
    console.error('Writing evaluation failed:', err)
    return { 
      success: false, 
      error: errorMsg || 'AI engine failed to score your essay response. Please try again.' 
    }
  }
}
