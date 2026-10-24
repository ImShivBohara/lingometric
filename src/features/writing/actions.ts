'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { evaluateEssay } from '@/lib/gemini'

/**
 * Server action to submit an essay response and trigger AI scoring/evaluation.
 */
export async function submitEssayAction(
  attemptId: string,
  promptId: string,
  essayText: string
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

  // 3. Fetch writing prompt constraints for validation
  const { data: prompt, error: promptError } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('id', promptId)
    .single()

  if (promptError || !prompt) {
    console.error('Failed to fetch writing prompt:', promptError?.message)
    return { success: false, error: 'Prompt verification failed' }
  }

  // Calculate word count
  const wordCount = essayText.trim() === '' ? 0 : essayText.trim().split(/\s+/).length
  console.log(`Submitting essay with ${wordCount} words for attempt ${attemptId}`)

  // We allow submission during auto-submit even if word count is out of bounds,
  // but we should log/track warnings. 

  try {
    // 4. Trigger Gemini Evaluation
    // This will hit the stop checkpoint if API keys are not set up.
    const evaluation = await evaluateEssay(prompt.prompt_text, essayText)

    // 5. Insert results into writing_evaluations
    const { error: insertError } = await supabase
      .from('writing_evaluations')
      .insert({
        attempt_id: attemptId,
        essay_text: essayText,
        grammar_score: evaluation.grammar_score,
        vocabulary_score: evaluation.vocabulary_score,
        coherence_score: evaluation.coherence_score,
        fluency_score: evaluation.fluency_score,
        overall_score: evaluation.overall_score,
        cefr_level: evaluation.cefr_level,
        feedback: evaluation.feedback,
        raw_response: evaluation.raw_response, // store raw response for debugging/auditability
      })

    if (insertError) {
      const payload = {
        attempt_id: attemptId,
        essay_text: essayText,
        grammar_score: evaluation.grammar_score,
        vocabulary_score: evaluation.vocabulary_score,
        coherence_score: evaluation.coherence_score,
        fluency_score: evaluation.fluency_score,
        overall_score: evaluation.overall_score,
        cefr_level: evaluation.cefr_level,
        feedback: evaluation.feedback,
        raw_response: evaluation.raw_response,
      }
      console.error('INSERT PAYLOAD:', JSON.stringify(payload, null, 2))
      console.error('SUPABASE ERROR OBJECT:', JSON.stringify(insertError, null, 2))
      console.error('FAILING TABLE NAME: writing_evaluations')
      console.error('FAILING COLUMN NAME (IF ANY): check RLS policies or schema columns')
      
      const errMsg = `Failed to save essay evaluation metrics: [Code: ${insertError.code}] ${insertError.message} (Details: ${insertError.details || 'None'}, Hint: ${insertError.hint || 'None'})`
      return { success: false, error: errMsg }
    }

    // 6. Update attempt record
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
      return { success: false, error: 'Failed to save test status update' }
    }

    // 7. Sync student profile current CEFR progress level
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ current_cefr_level: evaluation.cefr_level })
      .eq('id', user.id)

    if (userUpdateError) {
      console.error('Failed to sync student CEFR progress level:', userUpdateError.message)
      // We don't fail the entire submission if this sync fails, but we flag it
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
