'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { summarizeSession } from './assessmentSession'
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

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) {
    throw new Error('Authentication required')
  }

  // Prevent duplicate attempts: check for an existing IN_PROGRESS attempt for this user, test, and skill
  const { data: existingAttempt } = await supabase
    .from('attempts')
    .select('id, assessment_type')
    .eq('user_id', userId)
    .eq('test_id', testId)
    .eq('status', 'IN_PROGRESS')
    .eq('assessment_type', assessmentType)
    .is('session_id', null)
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
      user_id: userId,
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

  // 1. Verify questionId belongs to this attempt's assigned test questions
  const { data: assignedQuestion } = await supabase
    .from('test_reading_questions')
    .select('question_id')
    .eq('test_id', attempt.test_id)
    .eq('question_id', questionId)
    .eq('is_active', true)
    .maybeSingle()

  let isAssigned = !!assignedQuestion
  if (!isAssigned) {
    // Check fallback: questions linked via test sections
    const { data: section } = await supabase
      .from('sections')
      .select('id')
      .eq('test_id', attempt.test_id)
      .eq('type', 'Reading')
      .maybeSingle()

    if (section) {
      const { data: fallbackQ } = await supabase
        .from('questions')
        .select('id')
        .eq('id', questionId)
        .eq('section_id', section.id)
        .maybeSingle()

      isAssigned = !!fallbackQ
    }
  }

  if (!isAssigned) {
    return { success: false, error: 'Question does not belong to this assessment' }
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

  const { supabase, attempt } = owned.data
  const modifiable = assertModifiableAttempt(attempt, 'Reading')
  if (!modifiable.success) {
    return { success: false, error: modifiable.error }
  }

  // Trusted server-side RPC finalization
  // Computes score against database answer keys, rejects incomplete submissions,
  // and updates attempt status in a single atomic transaction.
  const { data, error: rpcError } = await supabase.rpc('submit_reading_attempt', {
    p_attempt_id: attemptId,
  })

  if (rpcError) {
    console.error('Failed to submit reading attempt via trusted RPC:', rpcError.message)
    return { success: false, error: rpcError.message || 'Attempt finalization failed to save' }
  }

  revalidatePath('/dashboard')
  return { success: true, data }
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

/** Start all four skill attempts atomically, or resume the existing session. */
export async function createFullAssessmentAction(testId: string) {
  if (!VALID_TEST_ID.test(testId)) throw new Error('A valid test identifier is required')
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/auth/login')
  const { data: sessionId, error } = await supabase.rpc('start_full_assessment', { p_test_id: testId })
  if (error || !sessionId) throw new Error(error?.message || 'Could not start assessment')
  const { data: sections, error: sectionsError } = await supabase.from('attempts')
    .select('*').eq('session_id', sessionId).eq('user_id', userId)
  if (sectionsError || !sections?.length) throw new Error('Could not load assessment sections')
  const { nextPath } = summarizeSession(sections)
  revalidatePath('/dashboard')
  redirect(nextPath || `/test/${sections[0].id}/results`)
}
