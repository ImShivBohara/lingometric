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

  // Retrieve the correct answer from the listening_questions table
  const { data: question, error: questionError } = await supabase
    .from('listening_questions')
    .select('correct_answer')
    .eq('id', questionId)
    .single()

  if (questionError || !question) {
    console.error('Listening question lookup failed:', questionError?.message)
    return { success: false, error: 'Question verification failed' }
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

  const { supabase, userId, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Listening')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // Fetch all responses for this attempt
  const { data: responses, error: responsesError } = await supabase
    .from('listening_responses')
    .select('is_correct')
    .eq('attempt_id', attemptId)

  if (responsesError || !responses || responses.length === 0) {
    console.error('Failed to calculate final listening score: responses missing')
    return { success: false, error: 'No responses registered for this attempt' }
  }

  const totalQuestions = responses.length
  const correctAnswers = responses.filter((r) => r.is_correct).length
  const finalScore = Math.round((correctAnswers / totalQuestions) * 100)

  // 3. Map final score to CEFR level based on standard bands
  let cefrLevel = 'B1' // Default fallback
  if (finalScore <= 20) {
    cefrLevel = 'A1'
  } else if (finalScore <= 40) {
    cefrLevel = 'A2'
  } else if (finalScore <= 60) {
    cefrLevel = 'B1'
  } else if (finalScore <= 80) {
    cefrLevel = 'B2'
  } else if (finalScore <= 90) {
    cefrLevel = 'C1'
  } else {
    cefrLevel = 'C2'
  }

  // 4. Update attempts table status
  const { error: updateError } = await supabase
    .from('attempts')
    .update({
      submitted_at: new Date().toISOString(),
      final_score: finalScore,
      cefr_level: cefrLevel,
      status: 'SUBMITTED',
    })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('status', 'IN_PROGRESS')

  if (updateError) {
    console.error('Failed to finalize listening attempt:', updateError.message)
    return { success: false, error: 'Attempt finalization failed to save' }
  }

  // 5. Sync user profile CEFR level
  const { error: userUpdateError } = await supabase
    .from('users')
    .update({ current_cefr_level: cefrLevel })
    .eq('id', userId)

  if (userUpdateError) {
    console.error('Failed to sync user profile CEFR level:', userUpdateError.message)
  }

  revalidatePath('/dashboard')
  return { success: true }
}
