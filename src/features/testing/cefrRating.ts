/**
 * CEFR Rating and Provisional Assessment Calibration
 * 
 * Defines canonical CEFR tier order (A1 -> C2), provisional diagnostic mapping,
 * and transparent level descriptors for LingoMetric.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export interface CefrDescriptor {
  tier: CefrLevel
  name: string
  shortSummary: string
  fullDescription: string
  provisionalNote: string
}

export const CEFR_DESCRIPTORS: Record<CefrLevel, CefrDescriptor> = {
  A1: {
    tier: 'A1',
    name: 'Beginner / Breakthrough',
    shortSummary: 'Basic vocabulary and everyday expressions',
    fullDescription: 'Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type.',
    provisionalNote: 'Indicative performance on introductory items.',
  },
  A2: {
    tier: 'A2',
    name: 'Elementary / Waystage',
    shortSummary: 'Routine tasks and direct exchanges',
    fullDescription: 'Can understand sentences and frequently used expressions related to areas of most immediate relevance (e.g. basic personal and family information, local geography, employment).',
    provisionalNote: 'Demonstrates functional elementary competence on tested items.',
  },
  B1: {
    tier: 'B1',
    name: 'Intermediate / Threshold',
    shortSummary: 'Main points of clear standard input',
    fullDescription: 'Can understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.',
    provisionalNote: 'Matches the diagnostic baseline for standard spoken and written communications.',
  },
  B2: {
    tier: 'B2',
    name: 'Upper-Intermediate / Vantage',
    shortSummary: 'Complex text and technical discussions',
    fullDescription: 'Can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialization.',
    provisionalNote: 'Represents the upper ceiling for short modular screening assessments.',
  },
  C1: {
    tier: 'C1',
    name: 'Advanced / Effective Operational',
    shortSummary: 'Demanding, longer texts with implicit meaning',
    fullDescription: 'Can understand a wide range of demanding, longer texts, and recognise implicit meaning. Can express ideas fluently and spontaneously without much obvious searching for expressions.',
    provisionalNote: 'Requires rigorous extended evaluation across multi-register contexts.',
  },
  C2: {
    tier: 'C2',
    name: 'Proficient / Mastery',
    shortSummary: 'Effortless understanding and nuanced precision',
    fullDescription: 'Can understand with ease practically everything heard or read. Can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation.',
    provisionalNote: 'Near-native fluency requiring comprehensive, multi-hour examination.',
  },
}

/**
 * Validates and normalizes a CEFR level string.
 */
export function parseCefrLevel(value: unknown): CefrLevel | null {
  if (typeof value !== 'string') return null
  const upper = value.trim().toUpperCase()
  return (CEFR_LEVELS as readonly string[]).includes(upper) ? (upper as CefrLevel) : null
}

/**
 * Calibrated Provisional CEFR mapping for short Reading screeners (A2-B2 content ceiling).
 * Accurately maps percentage score (0-100%) to an indicative tier.
 * Capped at B2 because a 5-question test cannot scientifically confirm C1/C2.
 */
export function calculateReadingProvisionalCefr(score: number): CefrLevel {
  if (score <= 20) return 'A1'
  if (score <= 45) return 'A2'
  if (score <= 75) return 'B1'
  return 'B2'
}

/**
 * Calibrated Provisional CEFR mapping for short Listening screeners (B1 passage).
 * Accurately maps percentage score (0-100%) to an indicative tier.
 * Capped at B1 because a 3-question B1 passage evaluates standard baseline listening.
 */
export function calculateListeningProvisionalCefr(score: number): CefrLevel {
  if (score < 34) return 'A1'
  if (score < 67) return 'A2'
  return 'B1'
}

/**
 * Universal provisional grading disclaimer for user-facing dashboards and reports.
 */
export const PROVISIONAL_GRADING_DISCLAIMER =
  'Provisional Diagnostic Result: This score reflects performance on a short diagnostic assessment and indicates provisional alignment with the CEFR framework. It is intended for practice and placement guidance, not formal institutional certification (such as IELTS, TOEFL, or Cambridge C2).'
