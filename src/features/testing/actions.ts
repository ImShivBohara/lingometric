'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getOwnedAttempt, assertModifiableAttempt } from './attemptAccess'
import {
  AssessmentType,
  getResumePath,
  parseAssessmentType,
  resolveAttemptSkill,
} from './attemptIdentity'

const VALID_TEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Creates a new test attempt for the active user and redirects to the test player.
 * If an active IN_PROGRESS attempt already exists for this test and assessment type,
 * safely redirects to resume it instead of creating duplicate attempts.
 */
export async function createTestAttemptAction(
  testId: string,
  initialSectionType: string
) {
  const assessmentType = parseAssessmentType(initialSectionType)
  if (!assessmentType) {
    throw new Error('A valid assessment type is required')
  }

  if (!VALID_TEST_ID.test(testId)) {
    throw new Error('A valid test identifier is required')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Prevent duplicate attempts: check for an existing IN_PROGRESS attempt for this user, test, and skill
  const { data: existingAttempt } = await supabase
    .from('attempts')
    .select('id, assessment_type')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'IN_PROGRESS')
    .eq('assessment_type', assessmentType)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingAttempt) {
    revalidatePath('/dashboard')
    redirect(getResumePath(existingAttempt.id, assessmentType))
  }

  const { data: attempt, error } = await supabase
    .from('attempts')
    .insert({
      user_id: user.id,
      test_id: testId,
      status: 'IN_PROGRESS',
      assessment_type: assessmentType,
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
  redirect(getResumePath(attempt.id, assessmentType))
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
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Reading')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

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

  const { error: responseError } = await supabase
    .from('responses')
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        score,
        time_taken_seconds: timeTakenSeconds,
      },
      { onConflict: 'attempt_id,question_id' }
    )

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
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, userId, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Reading')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

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

  let cefrLevel = 'B1'
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

  const { data: updatedAttempt, error: updateError } = await supabase
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
    .select('user_id')
    .single()

  if (updateError || !updatedAttempt) {
    console.error('Failed to update final attempt:', updateError?.message)
    return { success: false, error: 'Attempt finalization failed to save' }
  }

  if (updatedAttempt.user_id) {
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ current_cefr_level: cefrLevel })
      .eq('id', updatedAttempt.user_id)

    if (userUpdateError) {
      console.error('Failed to sync user profile CEFR progress level:', userUpdateError.message)
      return { success: false, error: 'Failed to sync profile progress level' }
    }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function resumeAttemptAction(attemptId: string) {
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    throw new Error(owned.error)
  }

  const modifiable = assertModifiableAttempt(owned.data.attempt)
  if (!modifiable.success) {
    throw new Error(modifiable.error)
  }

  const assessmentType =
    parseAssessmentType(owned.data.attempt.assessment_type) ??
    (resolveAttemptSkill(owned.data.attempt) !== 'Unknown'
      ? (resolveAttemptSkill(owned.data.attempt) as AssessmentType)
      : null)

  if (!assessmentType) {
    throw new Error('This attempt has no reliable assessment type and cannot be resumed')
  }

  redirect(getResumePath(attemptId, assessmentType))
}

export async function discardAttemptAction(attemptId: string) {
  const owned = await getOwnedAttempt(attemptId)
  if (!owned.success) {
    return { success: false, error: owned.error }
  }

  const { supabase, userId, attempt } = owned.data

  if (attempt.status === 'SUBMITTED') {
    return { success: false, error: 'Completed results cannot be discarded' }
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return { success: false, error: 'Only unfinished assessments can be discarded' }
  }

  const { data: updated, error } = await supabase
    .from('attempts')
    .update({ status: 'DISCARDED' })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('status', 'IN_PROGRESS')
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    console.error('Failed to discard attempt:', error?.message)
    return { success: false, error: 'Failed to discard this attempt' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
