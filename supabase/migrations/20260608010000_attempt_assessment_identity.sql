-- ============================================================================
-- Migration: 20260608010000_attempt_assessment_identity.sql
-- Purpose: Introduce explicit assessment_type on attempts, add DISCARDED status enum,
--          perform safe conservative historical backfill, and establish deterministic
--          deduplication and uniqueness on responses.
-- Execution Safety: Additive, idempotent, data-preserving. Does not drop user data.
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

-- 5. Safe, deterministic, auditable deduplication for reading responses:
-- Create audit backup table to retain any displaced duplicate records
CREATE TABLE IF NOT EXISTS public.responses_backup_duplicates (
    id UUID,
    attempt_id UUID,
    question_id UUID,
    selected_answer TEXT,
    is_correct BOOLEAN,
    score NUMERIC,
    time_taken_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Check for conflicting answers before any deletion:
-- If duplicate rows have different selected_answer values, abort to require manual inspection
DO $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM (
        SELECT attempt_id, question_id
        FROM public.responses
        GROUP BY attempt_id, question_id
        HAVING COUNT(DISTINCT selected_answer) > 1
    ) conflicts;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Cannot migrate: Found % conflicting duplicate reading responses with different selected_answer values. Manual review required before applying unique constraint.', conflict_count;
    END IF;
END $$;

-- For exact duplicates (same answer), archive displaced rows and deterministically keep the lowest UUID
WITH duplicates_to_archive AS (
    SELECT r.*
    FROM public.responses r
    JOIN (
        SELECT attempt_id, question_id, MIN(id::text) AS keep_id
        FROM public.responses
        GROUP BY attempt_id, question_id
        HAVING COUNT(*) > 1
    ) d ON r.attempt_id = d.attempt_id
       AND r.question_id = d.question_id
       AND r.id::text <> d.keep_id
)
INSERT INTO public.responses_backup_duplicates (
    id, attempt_id, question_id, selected_answer, is_correct, score, time_taken_seconds, created_at
)
SELECT id, attempt_id, question_id, selected_answer, is_correct, score, time_taken_seconds, created_at
FROM duplicates_to_archive;

DELETE FROM public.responses r
WHERE EXISTS (
    SELECT 1 FROM public.responses_backup_duplicates b
    WHERE b.id = r.id
);

-- 6. Enforce unique constraint on (attempt_id, question_id) to support upserts safely
DO $$
BEGIN
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
