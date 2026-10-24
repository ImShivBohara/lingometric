'use server'

import { revalidatePath } from 'next/cache'
import { assertModifiableAttempt, getOwnedAttempt } from '@/features/testing/attemptAccess'

/**
 * Persists an individual listening response to the database.
 */
export async function submitListeningResponseAction(
  attemptId: string,
  questionId: string,
  selectedAnswer: string,
  timeTakenSeconds: number
) {
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Listening')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // 1. Retrieve the question to get its parent passage
  const { data: question, error: questionError } = await supabase
    .from('listening_questions')
    .select('correct_answer, passage_id')
    .eq('id', questionId)
    .single()

  if (questionError || !question) {
    console.error('Listening question lookup failed:', questionError?.message)
    return { success: false, error: 'Question verification failed' }
  }

  // 2. Verify that the question's passage is assigned to this test
  const { data: assignedPassage } = await supabase
    .from('test_listening_passages')
    .select('id')
    .eq('test_id', attempt.test_id)
    .eq('passage_id', question.passage_id)
    .eq('is_active', true)
    .maybeSingle()

  let isAssigned = !!assignedPassage
  if (!isAssigned) {
    // Check fallback: listening_passages linked via section with test_id
    const { data: passage } = await supabase
      .from('listening_passages')
      .select('section_id')
      .eq('id', question.passage_id)
      .maybeSingle()

    if (passage) {
      const { data: section } = await supabase
        .from('sections')
        .select('id')
        .eq('id', passage.section_id)
        .eq('test_id', attempt.test_id)
        .eq('type', 'Listening')
        .maybeSingle()

      isAssigned = !!section
    }
  }

  if (!isAssigned) {
    return { success: false, error: 'Question does not belong to this assessment' }
  }

  const isCorrect = question.correct_answer.trim().toLowerCase() === selectedAnswer.trim().toLowerCase()
  const score = isCorrect ? 1 : 0

  // 3. Insert/Upsert response row in listening_responses table
  const { error: responseError } = await supabase
    .from('listening_responses')
    .upsert({
      attempt_id: attemptId,
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      score,
      time_taken_seconds: timeTakenSeconds,
    }, {
      onConflict: 'attempt_id,question_id'
    })

  if (responseError) {
    console.error('Failed to record listening response:', responseError.message)
    return { success: false, error: 'Failed to record response' }
  }

  return { success: true, isCorrect }
}

/**
 * Computes final listening scores, updates attempt status, and triggers revalidation.
 */
export async function submitFinalListeningAction(attemptId: string) {
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Listening')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // Trusted server-side RPC finalization
  // Computes score against database answer keys, rejects incomplete submissions,
  // and updates attempt status in a single atomic transaction.
  const { data, error: rpcError } = await supabase.rpc('submit_listening_attempt', {
    p_attempt_id: attemptId,
  })

  if (rpcError) {
    console.error('Failed to finalize listening attempt via trusted RPC:', rpcError.message)
    return { success: false, error: rpcError.message || 'Attempt finalization failed to save' }
  }

  revalidatePath('/dashboard')
  return { success: true, data }
}
