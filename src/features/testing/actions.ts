'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Creates a new test attempt for the active user and redirects to the test player.
 */
export async function createTestAttemptAction(
  testId: string,
  initialSectionType: 'Reading' | 'Listening' | 'Writing' | 'Speaking' = 'Reading'
) {
  const supabase = await createClient()

  // Get current user context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Create active attempt record
  const { data: attempt, error } = await supabase
    .from('attempts')
    .insert({
      user_id: user.id,
      test_id: testId,
      status: 'IN_PROGRESS',
    })
    .select()
    .single()

  if (error || !attempt) {
    console.error('Failed to create attempt:', error)
    const errMsg = error
      ? `Database initialization failed: [Code: ${error.code}] ${error.message} (Details: ${error.details || 'None'}, Hint: ${error.hint || 'None'})`
      : 'Database initialization failed: Attempt record is empty'
    throw new Error(errMsg)
  }

  revalidatePath('/dashboard')
  
  if (initialSectionType === 'Writing') {
    redirect(`/test/${attempt.id}/writing`)
  } else if (initialSectionType === 'Listening') {
    redirect(`/test/${attempt.id}/listening`)
  } else if (initialSectionType === 'Speaking') {
    redirect(`/test/${attempt.id}/speaking`)
  } else {
    redirect(`/test/${attempt.id}`)
  }
}

/**
 * Persists an individual answer response to the database.
 */
export async function submitResponseAction(
  attemptId: string,
  questionId: string,
  selectedAnswer: string,
  timeTakenSeconds: number
) {
  const supabase = await createClient()

  // Retrieve the correct answer from the questions table
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('correct_answer')
    .eq('id', questionId)
    .single()

  if (questionError || !question) {
    console.error('Question lookup failed:', questionError?.message)
    return { success: false, error: 'Question verification failed' }
  }

  const isCorrect = question.correct_answer.trim().toLowerCase() === selectedAnswer.trim().toLowerCase()
  const score = isCorrect ? 1 : 0

  // Insert response row
  const { error: responseError } = await supabase
    .from('responses')
    .insert({
      attempt_id: attemptId,
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      score,
      time_taken_seconds: timeTakenSeconds,
    })

  if (responseError) {
    console.error('Failed to insert response:', responseError.message)
    return { success: false, error: 'Failed to record response' }
  }

  return { success: true, isCorrect }
}

/**
 * Computes the final scores, updates attempt status, and redirects to the summary page.
 */
export async function submitFinalAttemptAction(attemptId: string) {
  const supabase = await createClient()

  // Fetch all responses for the attempt
  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('is_correct')
    .eq('attempt_id', attemptId)

  if (responsesError || !responses || responses.length === 0) {
    console.error('Failed to calculate final score: responses missing')
    return { success: false, error: 'No responses registered for this attempt' }
  }

  const totalQuestions = responses.length
  const correctAnswers = responses.filter((r) => r.is_correct).length
  const finalScore = Math.round((correctAnswers / totalQuestions) * 100)

  // Map final score to CEFR level based on PROJECT_MASTERPLAN.md specifications
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

  // Update attempts table and return user_id directly to save 1 select round-trip query
  const { data: attempt, error: updateError } = await supabase
    .from('attempts')
    .update({
      submitted_at: new Date().toISOString(),
      final_score: finalScore,
      cefr_level: cefrLevel,
      status: 'SUBMITTED',
    })
    .eq('id', attemptId)
    .select('user_id')
    .single()

  if (updateError || !attempt) {
    console.error('Failed to update final attempt:', updateError?.message)
    return { success: false, error: 'Attempt finalization failed to save' }
  }

  if (attempt.user_id) {
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ current_cefr_level: cefrLevel })
      .eq('id', attempt.user_id)

    if (userUpdateError) {
      console.error('Failed to sync user profile CEFR progress level:', userUpdateError.message)
      return { success: false, error: 'Failed to sync profile progress level' }
    }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
