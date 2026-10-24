// src/lib/supabase/queries.ts
import { createClient } from './server'
import { 
  UserProfile, 
  Test, 
  Section, 
  Attempt, 
  Response,
  WritingEvaluation,
  SpeakingEvaluation,
  Certificate
} from '@/types/database.types'

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error.message)
    return null
  }
  return data
}

export async function getPublishedTests(): Promise<Test[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('status', 'published')

  if (error) {
    console.error('Error fetching tests:', error.message)
    return []
  }
  return data || []
}

export async function getTestDetails(testId: string): Promise<(Test & { sections: Section[] }) | null> {
  const supabase = await createClient()
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (testError || !test) {
    console.error('Error fetching test:', testError?.message)
    return null
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select('*')
    .eq('test_id', testId)
    .order('display_order', { ascending: true })

  if (sectionsError) {
    console.error('Error fetching sections:', sectionsError.message)
    return { ...test, sections: [] }
  }

  return { ...test, sections: sections || [] }
}

export async function getUserAttempts(userId: string): Promise<Attempt[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (error) {
    console.error('Error fetching user attempts:', error.message)
    return []
  }
  return data || []
}

export async function createAttempt(userId: string, testId: string): Promise<Attempt | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attempts')
    .insert({
      user_id: userId,
      test_id: testId,
      status: 'IN_PROGRESS'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating attempt:', error.message)
    return null
  }
  return data
}

export async function submitResponse(
  attemptId: string, 
  questionId: string, 
  selectedAnswer: string, 
  isCorrect: boolean,
  score: number,
  timeTakenSeconds: number
): Promise<Response | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('responses')
    .insert({
      attempt_id: attemptId,
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      score,
      time_taken_seconds: timeTakenSeconds
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting response:', error.message)
    return null
  }
  return data
}

export async function getAttemptResults(attemptId: string): Promise<{
  attempt: Attempt | null;
  writingEvaluations: WritingEvaluation[];
  speakingEvaluations: SpeakingEvaluation[];
  certificate: Certificate | null;
} | null> {
  const supabase = await createClient()
  
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('*')
    .eq('id', attemptId)
    .single()

  if (attemptError || !attempt) {
    console.error('Error fetching attempt results:', attemptError?.message)
    return null
  }

  const { data: writing } = await supabase
    .from('writing_evaluations')
    .select('*')
    .eq('attempt_id', attemptId)

  const { data: speaking } = await supabase
    .from('speaking_evaluations')
    .select('*')
    .eq('attempt_id', attemptId)

  const { data: cert } = await supabase
    .from('certificates')
    .select('*')
    .eq('attempt_id', attemptId)
    .maybeSingle()

  return {
    attempt,
    writingEvaluations: writing || [],
    speakingEvaluations: speaking || [],
    certificate: cert || null
  }
}
