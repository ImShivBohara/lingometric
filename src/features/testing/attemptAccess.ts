import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Attempt, AttemptStatus, SectionType } from '@/types/database.types'
import {
  AssessmentType,
  AttemptSkillEvidence,
  getResumePath,
  parseAssessmentType,
  resolveAttemptSkill,
} from './attemptIdentity'

export interface OwnedAttemptResult {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  attempt: Attempt & AttemptSkillEvidence
}

export async function getOwnedAttempt(attemptId: string): Promise<
  | { success: true; data: OwnedAttemptResult }
  | { success: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const { data: attempt, error } = await supabase
    .from('attempts')
    .select('*, responses(id), listening_responses(id), writing_evaluations(id), speaking_evaluations(id)')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !attempt) {
    return { success: false, error: 'Failed to access test attempt' }
  }

  return {
    success: true,
    data: {
      supabase,
      userId: user.id,
      attempt: attempt as Attempt & AttemptSkillEvidence,
    },
  }
}

export function assertModifiableAttempt(
  attempt: Attempt & AttemptSkillEvidence,
  expectedType?: AssessmentType
): { success: true } | { success: false; error: string } {
  if (attempt.status === 'DISCARDED') {
    return { success: false, error: 'This assessment attempt was discarded' }
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return { success: false, error: 'This assessment attempt is already finalized' }
  }

  if (expectedType) {
    const resolvedType = parseAssessmentType(attempt.assessment_type) ?? resolveAttemptSkill(attempt)
    if (resolvedType !== 'Unknown' && resolvedType !== expectedType) {
      return { success: false, error: `This attempt is a ${resolvedType} assessment` }
    }
  }

  return { success: true }
}

export function asAttemptStatus(status: string): AttemptStatus {
  if (status === 'SUBMITTED' || status === 'DISCARDED' || status === 'IN_PROGRESS') {
    return status
  }
  return 'IN_PROGRESS'
}

export function asSectionType(value: string | null | undefined): SectionType | null {
  return parseAssessmentType(value)
}

export function enforceAttemptPlayerAccess(attempt: Attempt & AttemptSkillEvidence, expectedType: AssessmentType) {
  if (attempt.status === 'DISCARDED') {
    redirect('/dashboard')
  }

  if (attempt.status !== 'IN_PROGRESS') {
    redirect(`/test/${attempt.id}/results`)
  }

  const resolvedType = parseAssessmentType(attempt.assessment_type) ?? resolveAttemptSkill(attempt)
  if (!resolvedType || resolvedType === 'Unknown') {
    redirect('/dashboard')
  }

  if (resolvedType !== expectedType) {
    redirect(getResumePath(attempt.id, resolvedType as AssessmentType))
  }
}
