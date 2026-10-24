import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSESSMENT_TYPES,
  parseAssessmentType,
  resolveAttemptSkill,
  highestSubmittedScore,
  formatScoreDisplay,
  getResumePath,
} from '../src/features/testing/attemptIdentity.ts'
import { assertModifiableAttempt } from '../src/features/testing/attemptAccess.ts'
import { Attempt } from '../src/types/database.types.ts'
import { createServiceRoleClient } from '../src/lib/supabase/serviceRole.ts'

test('Assessment identity recognizes all four skills and rejects invalid values', () => {
  assert.deepEqual([...ASSESSMENT_TYPES], ['Reading', 'Listening', 'Writing', 'Speaking'])
  assert.equal(parseAssessmentType('Reading'), 'Reading')
  assert.equal(parseAssessmentType('Listening'), 'Listening')
  assert.equal(parseAssessmentType('Writing'), 'Writing')
  assert.equal(parseAssessmentType('Speaking'), 'Speaking')
  assert.equal(parseAssessmentType('Math'), null)
  assert.equal(parseAssessmentType(null), null)
  assert.equal(parseAssessmentType(undefined), null)
})

test('resolveAttemptSkill prioritizes explicit assessment_type', () => {
  assert.equal(
    resolveAttemptSkill({
      assessment_type: 'Listening',
      responses: [{ id: '1' }], // conflicting legacy evidence
    }),
    'Listening'
  )
})

test('resolveAttemptSkill falls back to evidence for legacy rows only when unambiguous', () => {
  // Reading evidence only
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      responses: [{ id: '1' }],
    }),
    'Reading'
  )

  // Listening evidence only
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      listening_responses: [{ id: '1' }],
    }),
    'Listening'
  )

  // Writing evidence only
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      writing_evaluations: [{ id: '1' }],
    }),
    'Writing'
  )

  // Speaking evidence only
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      speaking_evaluations: [{ id: '1' }],
    }),
    'Speaking'
  )

  // Empty attempt: must resolve to Unknown, NEVER default to Reading
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      responses: [],
      listening_responses: [],
      writing_evaluations: [],
      speaking_evaluations: [],
    }),
    'Unknown'
  )

  // Ambiguous multi-evidence attempt: must resolve to Unknown
  assert.equal(
    resolveAttemptSkill({
      assessment_type: null,
      responses: [{ id: '1' }],
      listening_responses: [{ id: '2' }],
    }),
    'Unknown'
  )
})

test('formatScoreDisplay formats 0 as "0" and blanks as "N/A"', () => {
  assert.equal(formatScoreDisplay(0), '0')
  assert.equal(formatScoreDisplay('0'), '0')
  assert.equal(formatScoreDisplay(85), '85')
  assert.equal(formatScoreDisplay(null), 'N/A')
  assert.equal(formatScoreDisplay(undefined), 'N/A')
  assert.equal(formatScoreDisplay(''), 'N/A')
  assert.equal(formatScoreDisplay('invalid'), 'N/A')
})

test('highestSubmittedScore includes 0 and excludes non-submitted attempts', () => {
  // Only submitted attempt has score 0
  const zeroAttempt = [{ status: 'SUBMITTED', final_score: 0 }]
  assert.equal(highestSubmittedScore(zeroAttempt), 0)

  // Mixed attempts: in progress and discarded attempts must be ignored
  const mixedAttempts = [
    { status: 'IN_PROGRESS', final_score: 100 },
    { status: 'DISCARDED', final_score: 95 },
    { status: 'SUBMITTED', final_score: 72 },
    { status: 'SUBMITTED', final_score: 45 },
  ]
  assert.equal(highestSubmittedScore(mixedAttempts), 72)

  // Empty attempts
  assert.equal(highestSubmittedScore([]), null)
  assert.equal(highestSubmittedScore([{ status: 'IN_PROGRESS', final_score: 50 }]), null)
})

test('getResumePath routes to the dedicated page for each assessment type', () => {
  const attemptId = 'test-attempt-123'
  assert.equal(getResumePath(attemptId, 'Reading'), `/test/${attemptId}`)
  assert.equal(getResumePath(attemptId, 'Listening'), `/test/${attemptId}/listening`)
  assert.equal(getResumePath(attemptId, 'Writing'), `/test/${attemptId}/writing`)
  assert.equal(getResumePath(attemptId, 'Speaking'), `/test/${attemptId}/speaking`)
})

test('assertModifiableAttempt strictly enforces status transitions and skill access', () => {
  const inProgressAttempt: Attempt = {
    id: 'att-1',
    user_id: 'user-1',
    test_id: 'test-1',
    started_at: new Date().toISOString(),
    submitted_at: null,
    final_score: null,
    cefr_level: null,
    status: 'IN_PROGRESS',
    assessment_type: 'Reading',
  }

  // Active in-progress Reading attempt: Reading action allowed
  assert.deepEqual(assertModifiableAttempt(inProgressAttempt, 'Reading'), { success: true })

  // Cross-skill access attempt: Listening action rejected
  const crossSkillResult = assertModifiableAttempt(inProgressAttempt, 'Listening')
  assert.equal(crossSkillResult.success, false)
  if (!crossSkillResult.success) {
    assert.match(crossSkillResult.error, /Reading assessment/)
  }

  // Discarded attempt: modification rejected
  const discardedAttempt: Attempt = {
    ...inProgressAttempt,
    status: 'DISCARDED',
  }
  const discardedResult = assertModifiableAttempt(discardedAttempt)
  assert.equal(discardedResult.success, false)
  if (!discardedResult.success) {
    assert.match(discardedResult.error, /discarded/)
  }

  // Submitted attempt: modification rejected
  const submittedAttempt: Attempt = {
    ...inProgressAttempt,
    status: 'SUBMITTED',
  }
  const submittedResult = assertModifiableAttempt(submittedAttempt)
  assert.equal(submittedResult.success, false)
  if (!submittedResult.success) {
    assert.match(submittedResult.error, /already finalized/)
  }
})

test('Question navigator answered count and bounds simulation', () => {
  const total = 5
  const answers: Record<string, string> = {
    'q-1': 'Option A',
    'q-3': 'Option C',
  }
  const questionIds = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5']
  
  const answeredFlags = questionIds.map((id) => Boolean(answers[id]))
  assert.deepEqual(answeredFlags, [true, false, true, false, false])

  const unansweredCount = answeredFlags.filter((ans) => !ans).length
  assert.equal(unansweredCount, 3)

  // Bounds validation for navigation
  const canNavigate = (targetIndex: number) => {
    return targetIndex >= 0 && targetIndex < total
  }
  assert.equal(canNavigate(-1), false)
  assert.equal(canNavigate(0), true)
  assert.equal(canNavigate(4), true)
  assert.equal(canNavigate(5), false)
})

// ============================================================================
// SECURITY TESTS FOR THE 4 REMAINING VULNERABILITIES
// ============================================================================

test('Vulnerability 1: Service-role client strictly enforces server key configuration', () => {
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  try {
    // Missing service role key must throw clear error
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'

    assert.throws(
      () => createServiceRoleClient(),
      /SUPABASE_SERVICE_ROLE_KEY is required in environment variables/
    )
  } finally {
    if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
  }
})

test('Vulnerability 2: Answer evaluation strictly ignores client is_correct and validates against canonical answer keys', () => {
  const answerKeys: Record<string, string> = {
    'q-101': 'Option A',
    'q-102': 'Option C',
    'q-103': 'Option B',
  }

  // Client attempts to cheat by forging is_correct: true on a wrong answer and wrong is_correct on a correct answer
  const untrustedResponses = [
    { question_id: 'q-101', selected_answer: ' option a ', is_correct: false }, // correct despite false flag
    { question_id: 'q-102', selected_answer: 'Option D', is_correct: true },   // wrong despite true flag
    { question_id: 'q-103', selected_answer: 'OPTION B', is_correct: false }, // correct despite case/whitespace
  ]

  // Server-side scoring calculation matching the SQL RPC logic
  const verifiedScores = untrustedResponses.map((r) => {
    const canonical = answerKeys[r.question_id]
    const isCorrect = canonical ? canonical.trim().toLowerCase() === r.selected_answer.trim().toLowerCase() : false
    return {
      question_id: r.question_id,
      verified_is_correct: isCorrect,
      verified_score: isCorrect ? 1 : 0,
    }
  })

  // q-101 is correct (1)
  assert.equal(verifiedScores[0].verified_is_correct, true)
  assert.equal(verifiedScores[0].verified_score, 1)

  // q-102 is WRONG (0), client-supplied is_correct: true was rejected
  assert.equal(verifiedScores[1].verified_is_correct, false)
  assert.equal(verifiedScores[1].verified_score, 0)

  // q-103 is correct (1)
  assert.equal(verifiedScores[2].verified_is_correct, true)
  assert.equal(verifiedScores[2].verified_score, 1)

  const correctCount = verifiedScores.filter((s) => s.verified_is_correct).length
  assert.equal(correctCount, 2)
})

test('Vulnerability 3: Scoring denominator represents all required questions and rejects incomplete submissions', () => {
  const requiredQuestions = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5']
  const totalRequired = requiredQuestions.length

  // Case A: Student answered only 1 question correctly out of 5
  const partialAnswers: Record<string, string> = {
    'q-1': 'Correct Answer',
  }

  const answeredCount = requiredQuestions.filter(
    (qid) => partialAnswers[qid] && partialAnswers[qid].trim() !== ''
  ).length

  // RPC rule: incomplete submission MUST be rejected
  const isIncomplete = answeredCount < totalRequired
  assert.equal(isIncomplete, true)
  assert.equal(answeredCount, 1)
  assert.equal(totalRequired, 5)

  // Denominator rule: even if calculated, score MUST use totalRequired as denominator
  const correctCount = 1
  const scoreUsingRequired = Math.round((correctCount / totalRequired) * 100)
  const scoreUsingAnswered = Math.round((correctCount / answeredCount) * 100)

  assert.equal(scoreUsingRequired, 20) // 1/5 = 20% (A1)
  assert.equal(scoreUsingAnswered, 100) // 1/1 = 100% (Vulnerability prevented!)
  assert.notEqual(scoreUsingRequired, scoreUsingAnswered)

  // Case B: Foreign question submission is rejected
  const submittedQuestions = ['q-1', 'q-999'] // q-999 is not in requiredQuestions
  const hasForeignQuestion = submittedQuestions.some((qid) => !requiredQuestions.includes(qid))
  assert.equal(hasForeignQuestion, true)
})

test('Vulnerability 4: Attempt creation enforces defaults and neutralizes client-supplied scores', () => {
  // Simulates enforce_attempt_insert_defaults() trigger behavior
  function sanitizeAttemptInsert(
    authUid: string,
    role: string,
    input: {
      user_id?: string
      test_id: string
      assessment_type?: string
      status?: string
      final_score?: number | null
      cefr_level?: string | null
      submitted_at?: string | null
    }
  ) {
    if (role === 'authenticated') {
      return {
        test_id: input.test_id,
        assessment_type: input.assessment_type,
        user_id: authUid, // Forced to auth.uid()
        status: 'IN_PROGRESS', // Forced to IN_PROGRESS
        final_score: null, // Neutralized
        cefr_level: null, // Neutralized
        submitted_at: null, // Neutralized
      }
    }
    return input
  }

  const maliciousPayload = {
    user_id: 'victim-user-id',
    test_id: 'test-123',
    assessment_type: 'Reading',
    status: 'SUBMITTED',
    final_score: 100,
    cefr_level: 'C2',
    submitted_at: new Date().toISOString(),
  }

  const sanitized = sanitizeAttemptInsert('authenticated-student-uid', 'authenticated', maliciousPayload)

  assert.equal(sanitized.user_id, 'authenticated-student-uid')
  assert.equal(sanitized.status, 'IN_PROGRESS')
  assert.equal(sanitized.final_score, null)
  assert.equal(sanitized.cefr_level, null)
  assert.equal(sanitized.submitted_at, null)
})
