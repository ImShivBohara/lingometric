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
