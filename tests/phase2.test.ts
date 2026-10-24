import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  CEFR_LEVELS,
  CEFR_DESCRIPTORS,
  parseCefrLevel,
  calculateReadingProvisionalCefr,
  calculateListeningProvisionalCefr,
  PROVISIONAL_GRADING_DISCLAIMER,
} from '../src/features/testing/cefrRating.ts'

test('CEFR levels follow canonical order from A1 (beginner) to C2 (proficient)', () => {
  const expectedOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  assert.deepEqual([...CEFR_LEVELS], expectedOrder)

  // Verify progression: index represents increasing proficiency
  assert.ok(CEFR_LEVELS.indexOf('A1') < CEFR_LEVELS.indexOf('A2'))
  assert.ok(CEFR_LEVELS.indexOf('A2') < CEFR_LEVELS.indexOf('B1'))
  assert.ok(CEFR_LEVELS.indexOf('B1') < CEFR_LEVELS.indexOf('B2'))
  assert.ok(CEFR_LEVELS.indexOf('B2') < CEFR_LEVELS.indexOf('C1'))
  assert.ok(CEFR_LEVELS.indexOf('C1') < CEFR_LEVELS.indexOf('C2'))
})

test('parseCefrLevel normalizes valid inputs and rejects invalid ones', () => {
  assert.equal(parseCefrLevel('a1'), 'A1')
  assert.equal(parseCefrLevel('B2 '), 'B2')
  assert.equal(parseCefrLevel('c2'), 'C2')
  assert.equal(parseCefrLevel('C3'), null)
  assert.equal(parseCefrLevel(''), null)
  assert.equal(parseCefrLevel(null), null)
  assert.equal(parseCefrLevel(undefined), null)
  assert.equal(parseCefrLevel(100), null)
})

test('All CEFR tiers have complete descriptors with provisional transparency notes', () => {
  for (const tier of CEFR_LEVELS) {
    const desc = CEFR_DESCRIPTORS[tier]
    assert.ok(desc, `Descriptor exists for ${tier}`)
    assert.equal(desc.tier, tier)
    assert.ok(desc.name.length > 0)
    assert.ok(desc.shortSummary.length > 0)
    assert.ok(desc.fullDescription.length > 0)
    assert.ok(desc.provisionalNote.length > 0)
  }
})

test('Reading provisional CEFR calibration caps short diagnostic test at B2', () => {
  // Score 0% - 20% -> A1
  assert.equal(calculateReadingProvisionalCefr(0), 'A1')
  assert.equal(calculateReadingProvisionalCefr(20), 'A1')

  // Score 21% - 45% -> A2
  assert.equal(calculateReadingProvisionalCefr(21), 'A2')
  assert.equal(calculateReadingProvisionalCefr(40), 'A2')
  assert.equal(calculateReadingProvisionalCefr(45), 'A2')

  // Score 46% - 75% -> B1
  assert.equal(calculateReadingProvisionalCefr(46), 'B1')
  assert.equal(calculateReadingProvisionalCefr(60), 'B1')
  assert.equal(calculateReadingProvisionalCefr(75), 'B1')

  // Score 76% - 100% -> B2 (Provisional ceiling for 5-question A2-B2 diagnostic)
  // Crucial requirement: Perfect score on 5 MCQs does NOT falsely award C1 or C2
  assert.equal(calculateReadingProvisionalCefr(80), 'B2')
  assert.equal(calculateReadingProvisionalCefr(100), 'B2')
  assert.notEqual(calculateReadingProvisionalCefr(100), 'C2')
})

test('Listening provisional CEFR calibration caps B1 passage test at B1', () => {
  // 0 of 3 (0%) -> A1
  assert.equal(calculateListeningProvisionalCefr(0), 'A1')
  assert.equal(calculateListeningProvisionalCefr(33), 'A1')

  // 1 of 3 (33.3%) -> A1 (or up to 66% -> A2)
  assert.equal(calculateListeningProvisionalCefr(34), 'A2')
  assert.equal(calculateListeningProvisionalCefr(66), 'A2')

  // 3 of 3 (100%) -> B1 (Passage baseline level)
  // Crucial requirement: Perfect score on 3 MCQs on a B1 passage does NOT falsely award C2
  assert.equal(calculateListeningProvisionalCefr(67), 'B1')
  assert.equal(calculateListeningProvisionalCefr(100), 'B1')
  assert.notEqual(calculateListeningProvisionalCefr(100), 'C2')
})

test('Universal provisional grading disclaimer is defined and informative', () => {
  assert.ok(PROVISIONAL_GRADING_DISCLAIMER.includes('Provisional Diagnostic Result'))
  assert.ok(PROVISIONAL_GRADING_DISCLAIMER.includes('CEFR'))
})

test('.env.example contains only safe placeholders without leaking credentials', () => {
  const envExamplePath = path.resolve(process.cwd(), '.env.example')
  assert.ok(fs.existsSync(envExamplePath), '.env.example must exist')

  const content = fs.readFileSync(envExamplePath, 'utf-8')
  assert.ok(content.includes('NEXT_PUBLIC_SUPABASE_URL='))
  assert.ok(content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY='))
  assert.ok(content.includes('SUPABASE_SERVICE_ROLE_KEY='))
  assert.ok(content.includes('GEMINI_API_KEY='))

  // Ensure no real API keys leaked into .env.example
  assert.ok(!content.includes('eyJ'), 'No JWT tokens in .env.example')
  assert.ok(!content.includes('AIzaSy'), 'No Google AI Studio keys in .env.example')
})
