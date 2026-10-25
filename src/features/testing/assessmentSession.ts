import type { Attempt } from '@/types/database.types'
import { ASSESSMENT_TYPES, getResumePath } from './attemptIdentity'

export function orderSections<T extends Pick<Attempt, 'assessment_type'>>(attempts: T[]): T[] {
  return [...attempts].sort((a, b) =>
    ASSESSMENT_TYPES.indexOf(a.assessment_type!) - ASSESSMENT_TYPES.indexOf(b.assessment_type!))
}

export function summarizeSession<T extends Pick<Attempt, 'id' | 'assessment_type' | 'status' | 'final_score'>>(attempts: T[]) {
  const sections = orderSections(attempts)
  const complete = sections.length === 4 && ASSESSMENT_TYPES.every(type =>
    sections.filter(a => a.assessment_type === type && a.status === 'SUBMITTED').length === 1)
  const discarded = sections.some(a => a.status === 'DISCARDED')
  const next = discarded ? undefined : sections.find(a => a.status === 'IN_PROGRESS')
  const scores = sections.map(a => a.final_score)
  const score = complete && scores.every(s => s !== null && s !== undefined && Number.isFinite(Number(s)))
    ? Math.round(scores.reduce<number>((sum, s) => sum + Number(s), 0) / 4 * 100) / 100
    : null
  return {
    sections, complete, discarded, score,
    completedCount: sections.filter(a => a.status === 'SUBMITTED').length,
    nextPath: next ? getResumePath(next.id, next.assessment_type!) : null,
  }
}

// Count a linked session once, while retaining each independent legacy attempt.
export function groupAssessmentAttempts<T extends Pick<Attempt, 'id'> & { session_id?: string | null }>(attempts: T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const attempt of attempts) {
    const key = attempt.session_id ? `session:${attempt.session_id}` : `attempt:${attempt.id}`
    groups.set(key, [...(groups.get(key) || []), attempt])
  }
  return [...groups.values()]
}
