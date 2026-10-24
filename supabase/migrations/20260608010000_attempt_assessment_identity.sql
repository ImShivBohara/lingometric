-- ============================================================================
-- Migration: 20260608010000_attempt_assessment_identity.sql
-- Purpose: Introduce explicit assessment_type on attempts, add DISCARDED status enum,
--          perform safe conservative historical backfill, and establish deterministic,
--          non-destructive duplicate checking and uniqueness on reading responses.
-- Execution Safety: Additive, idempotent, non-destructive.
--                   Does NOT delete, archive, or drop student records.
-- ============================================================================

-- 1. Allow unfinished attempts to be discarded without row deletion.
-- Note: 'DISCARDED' enum value must not be referenced in statements inside the
-- same transaction in PostgreSQL. References to 'DISCARDED' in constraints, triggers,
-- or policies are separated into migration 20260608020000.
ALTER TYPE public.attempt_status ADD VALUE IF NOT EXISTS 'DISCARDED';

-- 2. Persist the skill explicitly for each attempt. NULL indicates legacy unclassified rows.
ALTER TABLE public.attempts
    ADD COLUMN IF NOT EXISTS assessment_type public.section_type;

CREATE INDEX IF NOT EXISTS idx_attempts_assessment_type
    ON public.attempts (assessment_type);

CREATE INDEX IF NOT EXISTS idx_attempts_user_status
    ON public.attempts (user_id, status);

-- 3. Conservative, evidence-based backfill:
-- Set assessment_type ONLY when exactly one skill evaluation/response table contains rows.
-- If multiple skills or no skills have evidence, the column remains NULL (Unknown).

-- Backfill Writing
UPDATE public.attempts AS a
SET assessment_type = 'Writing'
WHERE a.assessment_type IS NULL
  AND EXISTS (
      SELECT 1 FROM public.writing_evaluations we WHERE we.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.speaking_evaluations se WHERE se.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.listening_responses lr WHERE lr.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.responses r WHERE r.attempt_id = a.id
  );

-- Backfill Speaking
UPDATE public.attempts AS a
SET assessment_type = 'Speaking'
WHERE a.assessment_type IS NULL
  AND EXISTS (
      SELECT 1 FROM public.speaking_evaluations se WHERE se.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.writing_evaluations we WHERE we.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.listening_responses lr WHERE lr.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.responses r WHERE r.attempt_id = a.id
  );

-- Backfill Listening
UPDATE public.attempts AS a
SET assessment_type = 'Listening'
WHERE a.assessment_type IS NULL
  AND EXISTS (
      SELECT 1 FROM public.listening_responses lr WHERE lr.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.writing_evaluations we WHERE we.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.speaking_evaluations se WHERE se.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.responses r WHERE r.attempt_id = a.id
  );

-- Backfill Reading
UPDATE public.attempts AS a
SET assessment_type = 'Reading'
WHERE a.assessment_type IS NULL
  AND EXISTS (
      SELECT 1 FROM public.responses r WHERE r.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.writing_evaluations we WHERE we.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.speaking_evaluations se WHERE se.attempt_id = a.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.listening_responses lr WHERE lr.attempt_id = a.id
  );

-- 4. Ensure created_at exists on public.responses for future deterministic ordering
ALTER TABLE public.responses
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 5. Non-destructive duplicate check and unique constraint enforcement:
-- Instead of silently deleting or creating duplicate backup tables, this checks whether
-- any duplicate (attempt_id, question_id) rows exist.
-- If duplicates are found, it aborts with a descriptive error requiring manual review.
-- If no duplicates exist, it safely applies the unique constraint.
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT attempt_id, question_id
        FROM public.responses
        GROUP BY attempt_id, question_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Cannot apply unique constraint: Found % duplicate reading response group(s) in public.responses. Non-destructive migration aborted. Manual inspection and resolution required.', dup_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_attempt_reading_question'
    ) THEN
        ALTER TABLE public.responses
            ADD CONSTRAINT unique_attempt_reading_question
            UNIQUE (attempt_id, question_id);
    END IF;
END $$;
