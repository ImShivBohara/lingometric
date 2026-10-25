// src/types/database.types.ts

export type UserRole = 'student' | 'admin';
export type TestStatus = 'draft' | 'published' | 'archived';
export type SectionType = 'Reading' | 'Listening' | 'Writing' | 'Speaking';
export type DifficultyTier = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'DISCARDED';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  current_cefr_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  is_adaptive: boolean;
  status: TestStatus;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  test_id: string;
  name: string;
  type: SectionType;
  display_order: number;
}


export interface Question {
  id: string;
  section_id: string;
  question_type: string;
  difficulty_level: DifficultyTier;
  question_text: string;
  options: string[] | Record<string, unknown> | null;
  correct_answer?: string;
  explanation?: string | null;
  estimated_time_seconds: number;
  category: string;
  created_at: string;
}

export type StudentQuestion = Omit<Question, 'correct_answer' | 'explanation'>;

export interface AudioFile {
  id: string;
  question_id: string;
  file_url: string;
  duration_seconds: number;
  transcript: string | null;
  created_at: string;
}
export interface WritingPrompt {
  id: string;
  section_id: string;
  prompt_text: string;
  minimum_words: number;
  maximum_words: number;
  difficulty_level: DifficultyTier;
  is_active: boolean;
}

export interface SpeakingPrompt {
  id: string;
  section_id: string;
  prompt_text: string;
  expected_duration_seconds: number;
  difficulty_level: DifficultyTier;
  is_active: boolean;
}

export interface Attempt {
  id: string;
  user_id: string;
  test_id: string;
  started_at: string;
  submitted_at: string | null;
  final_score: number | null;
  cefr_level: string | null;
  status: AttemptStatus;
  assessment_type: SectionType | null;
}

export interface Response {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  score: number;
  time_taken_seconds: number | null;
}

export interface WritingEvaluation {
  id: string;
  attempt_id: string;
  essay_text: string;
  grammar_score: number | null;
  vocabulary_score: number | null;
  coherence_score: number | null;
  fluency_score: number | null;
  overall_score: number | null;
  cefr_level: string | null;
  feedback: Record<string, unknown> | null;
}

export interface SpeakingEvaluation {
  id: string;
  attempt_id: string;
  audio_url: string;
  transcript: string | null;
  pronunciation_score: number | null;
  grammar_score: number | null;
  fluency_score: number | null;
  vocabulary_score: number | null;
  overall_score: number | null;
  cefr_level: string | null;
  feedback: Record<string, unknown> | null;
  raw_response?: Record<string, unknown> | null;
}

export interface Certificate {
  id: string;
  attempt_id: string;
  certificate_code: string;
  pdf_url: string;
  issued_at: string;
  verification_hash: string;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TestListeningPassage {
  id: string;
  test_id: string;
  passage_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface TestReadingQuestion {
  id: string;
  test_id: string;
  question_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

