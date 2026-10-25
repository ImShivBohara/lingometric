import test from 'node:test'
import assert from 'node:assert/strict'
import { groupAssessmentAttempts, summarizeSession } from '../src/features/testing/assessmentSession'
import { ASSESSMENT_TYPES } from '../src/features/testing/attemptIdentity'
import type { Attempt } from '../src/types/database.types'

const complete = ASSESSMENT_TYPES.map((assessment_type, index) => ({
  id: `section-${index}`, assessment_type, status: 'SUBMITTED' as const,
  final_score: [0, 100, 60, 80][index], session_id: 'session-1',
}))

test('full assessment averages four skills equally, preserving zero scores', () => {
  const result = summarizeSession([...complete].reverse())
  assert.equal(result.complete, true)
  assert.equal(result.score, 60)
  assert.equal(result.nextPath, null)
  assert.deepEqual(result.sections.map(a => a.assessment_type), [...ASSESSMENT_TYPES])
})

test('unfinished sessions resume the first unfinished skill and expose no final score', () => {
  const attempts = complete.map((a, i) => i > 0 ? { ...a, status: 'IN_PROGRESS' as const, final_score: null } : a)
  const result = summarizeSession(attempts.reverse())
  assert.equal(result.complete, false)
  assert.equal(result.score, null)
  assert.equal(result.completedCount, 1)
  assert.equal(result.nextPath, '/test/section-1/listening')
})

test('missing or duplicate skills cannot produce a complete final result', () => {
  assert.equal(summarizeSession(complete.slice(1)).complete, false)
  assert.equal(summarizeSession([complete[0], complete[0], complete[2], complete[3]]).complete, false)
  assert.equal(summarizeSession(complete.map(a => ({ ...a, final_score: null }))).score, null)
})

test('discarded sessions cannot be resumed', () => {
  const result = summarizeSession(complete.map((a, i) => ({ ...a, status: (i === 0 ? 'DISCARDED' : 'IN_PROGRESS') as Attempt['status'] })))
  assert.equal(result.discarded, true)
  assert.equal(result.nextPath, null)
  assert.equal(result.score, null)
})

test('grouping counts each full session once and retains independent legacy attempts', () => {
  const groups = groupAssessmentAttempts([...complete, { ...complete[0], id: 'legacy-1', session_id: null }, { ...complete[0], id: 'legacy-2', session_id: null }])
  assert.equal(groups.length, 3)
  assert.equal(groups[0].length, 4)
  assert.equal(groups[1][0].id, 'legacy-1')
  assert.equal(groups[2][0].id, 'legacy-2')
})
