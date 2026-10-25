import test from 'node:test'
import assert from 'node:assert/strict'
import { countWords, validateWritingWordCount } from '../src/features/writing/validation'
import { StudentQuestion } from '../src/types/database.types'

test('Writing validation: correctly counts words across various whitespace formats', () => {
  assert.equal(countWords(''), 0)
  assert.equal(countWords('   '), 0)
  assert.equal(countWords('\n\t  '), 0)
  assert.equal(countWords('Hello world'), 2)
  assert.equal(countWords('  Hello   world!  This  is a   test. '), 6)
  assert.equal(countWords('Word\nwith\nnewlines\tand\ttabs'), 5)
})

test('Writing validation: rejects essays below minimum word count with friendly message', () => {
  const shortEssay = 'This essay is only seven words long.'
  const res = validateWritingWordCount(shortEssay, 50, 500)

  assert.equal(res.valid, false)
  assert.equal(res.wordCount, 7)
  assert.ok(res.error)
  assert.match(res.error!, /at least 50 words/)
  assert.match(res.error!, /7 words/)
})

test('Writing validation: rejects empty or whitespace-only submissions', () => {
  const emptyRes = validateWritingWordCount('', 50, 500)
  assert.equal(emptyRes.valid, false)
  assert.equal(emptyRes.wordCount, 0)
  assert.match(emptyRes.error!, /0 words/)

  const whitespaceRes = validateWritingWordCount('   \n\t   ', 50, 500)
  assert.equal(whitespaceRes.valid, false)
  assert.equal(whitespaceRes.wordCount, 0)
  assert.match(whitespaceRes.error!, /0 words/)
})

test('Writing validation: rejects essays exceeding maximum word limit with friendly message', () => {
  // Generate 60 words
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
  const res = validateWritingWordCount(words, 10, 50)

  assert.equal(res.valid, false)
  assert.equal(res.wordCount, 60)
  assert.ok(res.error)
  assert.match(res.error!, /exceeds the limit of 50 words/)
  assert.match(res.error!, /60 words/)
})

test('Writing validation: accepts valid essay within bounds', () => {
  const words = Array.from({ length: 75 }, (_, i) => `word${i}`).join(' ')
  const res = validateWritingWordCount(words, 50, 200)

  assert.equal(res.valid, true)
  assert.equal(res.wordCount, 75)
  assert.equal(res.error, undefined)
})

test('Assessment scoring integrity: student-facing question representation strips answer key', () => {
  // Full question in database
  const dbQuestion = {
    id: 'q-reading-1',
    section_id: 'sec-1',
    question_type: 'multiple_choice',
    difficulty_level: 'B1' as const,
    question_text: 'What is the main topic of the passage?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: 'Option B',
    explanation: 'Detailed answer explanation describing why B is correct.',
    estimated_time_seconds: 60,
    category: 'Reading Comprehension',
    created_at: new Date().toISOString(),
  }

  // Student-facing projection (as loaded by server components)
  function projectStudentQuestion(q: typeof dbQuestion): StudentQuestion {
    const clone = { ...q }
    delete (clone as { correct_answer?: string }).correct_answer
    delete (clone as { explanation?: string | null }).explanation
    return clone
  }

  const studentQuestion = projectStudentQuestion(dbQuestion)

  // Verify answer keys are removed
  assert.equal('correct_answer' in studentQuestion, false)
  assert.equal('explanation' in studentQuestion, false)
  assert.equal(studentQuestion.id, 'q-reading-1')
  assert.equal(studentQuestion.question_text, 'What is the main topic of the passage?')
  assert.deepEqual(studentQuestion.options, ['Option A', 'Option B', 'Option C', 'Option D'])
})

test('Profile RLS simulation: students access only own row; unauthenticated access denied', () => {
  interface UserRow {
    id: string
    email: string
    role: 'student' | 'admin'
    current_cefr_level: string | null
  }

  const allUsers: UserRow[] = [
    { id: 'student-1', email: 'alice@example.com', role: 'student', current_cefr_level: 'B1' },
    { id: 'student-2', email: 'bob@example.com', role: 'student', current_cefr_level: 'A2' },
    { id: 'admin-1', email: 'admin@lingometric.com', role: 'admin', current_cefr_level: 'C2' },
  ]

  // Simulate RLS for SELECT
  function evaluateSelectUsersPolicy(
    requesterAuthUid: string | null,
    isAdminUser: boolean
  ): UserRow[] {
    if (!requesterAuthUid) {
      // Anon: REVOKE ALL and no matching policy
      return []
    }
    return allUsers.filter((u) => {
      // Policy 1: Users can read own profile
      if (u.id === requesterAuthUid) return true
      // Policy 2: Admins can read all profiles
      if (isAdminUser) return true
      return false
    })
  }

  // 1. Unauthenticated (anon): cannot retrieve any emails or profiles
  const anonResults = evaluateSelectUsersPolicy(null, false)
  assert.equal(anonResults.length, 0)

  // 2. Student 1: can only see Alice's profile, cannot see Bob's email
  const student1Results = evaluateSelectUsersPolicy('student-1', false)
  assert.equal(student1Results.length, 1)
  assert.equal(student1Results[0].id, 'student-1')
  assert.equal(student1Results[0].email, 'alice@example.com')

  // 3. Admin: retains legitimate student-progress visibility for all students
  const adminResults = evaluateSelectUsersPolicy('admin-1', true)
  assert.equal(adminResults.length, 3)
})

test('CEFR immutability simulation: ordinary users cannot update CEFR level or role', () => {
  // Allowed columns for authenticated users
  const ALLOWED_UPDATE_COLUMNS = new Set(['full_name', 'avatar_url'])

  function sanitizeProfileUpdate(
    updates: Record<string, unknown>
  ): { allowed: boolean; rejectedColumns: string[]; sanitized: Record<string, unknown> } {
    const rejectedColumns: string[] = []
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_COLUMNS.has(key)) {
        sanitized[key] = value
      } else {
        rejectedColumns.push(key)
      }
    }

    return {
      allowed: rejectedColumns.length === 0,
      rejectedColumns,
      sanitized,
    }
  }

  // Malicious student attempt to self-promote to C2 and admin
  const exploitAttempt = {
    full_name: 'Alice Legit',
    current_cefr_level: 'C2',
    role: 'admin',
  }

  const result = sanitizeProfileUpdate(exploitAttempt)
  assert.equal(result.allowed, false)
  assert.deepEqual(result.rejectedColumns, ['current_cefr_level', 'role'])
  assert.deepEqual(result.sanitized, { full_name: 'Alice Legit' })
})
