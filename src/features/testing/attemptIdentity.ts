import { AttemptStatus, SectionType } from '@/types/database.types'

export const ASSESSMENT_TYPES = ['Reading', 'Listening', 'Writing', 'Speaking'] as const

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]
export type DisplayAssessmentType = AssessmentType | 'Unknown'

export const ASSESSMENT_TYPE_SET = new Set<string>(ASSESSMENT_TYPES)

export function isAssessmentType(value: unknown): value is AssessmentType {
  return typeof value === 'string' && ASSESSMENT_TYPE_SET.has(value)
}

export function parseAssessmentType(value: unknown): AssessmentType | null {
  return isAssessmentType(value) ? value : null
}

export function getResumePath(attemptId: string, type: AssessmentType): string {
  switch (type) {
    case 'Listening':
      return `/test/${attemptId}/listening`
    case 'Writing':
      return `/test/${attemptId}/writing`
    case 'Speaking':
      return `/test/${attemptId}/speaking`
    case 'Reading':
    default:
      return `/test/${attemptId}`
  }
}

export function formatScoreDisplay(score: number | string | null | undefined): string {
  if (score === null || score === undefined || score === '') {
    return 'N/A'
  }

  const numericScore = typeof score === 'number' ? score : Number(score)
  if (Number.isNaN(numericScore)) {
    return 'N/A'
  }

  return String(numericScore)
}

export function isSubmittedAttempt(status: AttemptStatus | string): boolean {
  return status === 'SUBMITTED'
}

export function isInProgressAttempt(status: AttemptStatus | string): boolean {
  return status === 'IN_PROGRESS'
}

export interface AttemptSkillEvidence {
  assessment_type?: SectionType | string | null
  writing_evaluations?: unknown[] | null
  listening_responses?: unknown[] | null
  speaking_evaluations?: unknown[] | null
  responses?: unknown[] | null
}

export function resolveAttemptSkill(attempt: AttemptSkillEvidence): DisplayAssessmentType {
  const storedType = parseAssessmentType(attempt.assessment_type)
  if (storedType) {
    return storedType
  }

  const hasWriting = (attempt.writing_evaluations?.length ?? 0) > 0
  const hasSpeaking = (attempt.speaking_evaluations?.length ?? 0) > 0
  const hasListening = (attempt.listening_responses?.length ?? 0) > 0
  const hasReading = (attempt.responses?.length ?? 0) > 0

  const matches: AssessmentType[] = []
  if (hasReading) matches.push('Reading')
  if (hasListening) matches.push('Listening')
  if (hasWriting) matches.push('Writing')
  if (hasSpeaking) matches.push('Speaking')

  if (matches.length === 1) {
    return matches[0]
  }

  return 'Unknown'
}

export function highestSubmittedScore(
  attempts: Array<{ status?: string | null; final_score?: number | string | null }>
): number | null {
  const scores = attempts
    .filter((attempt) => attempt.status === 'SUBMITTED' && attempt.final_score != null && attempt.final_score !== '')
    .map((attempt) => Number(attempt.final_score))
    .filter((score) => !Number.isNaN(score))

  if (scores.length === 0) {
    return null
  }

  return Math.max(...scores)
}
