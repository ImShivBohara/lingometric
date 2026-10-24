-- ============================================================================
-- Migration: 20260608020000_attempt_security_and_constraints.sql
-- Purpose: 
--   1. Enforce strict database-level transition and immutability rules on attempts.
--   2. Restrict INSERT and UPDATE privileges to prevent client-side score forgery.
--   3. Tighten RLS policies on attempts, responses, and listening_responses while
--      preserving legitimate admin visibility.
--   4. Introduce trusted SECURITY DEFINER functions for scoring and evaluation:
--      - Reading and Listening recalculate score against database answer keys
--        and enforce complete submissions (rejecting incomplete answers and arbitrary question IDs).
--      - Writing and Speaking are restricted exclusively to service_role callers
--        with authenticated session verification.
-- Execution Safety: Runs in a separate transaction after 20260608010000 has committed.
-- ============================================================================

-- 1. Database trigger function to enforce attempt immutability and valid state transitions
CREATE OR REPLACE FUNCTION public.enforce_attempt_state_transition()
RETURNS trigger AS $$
BEGIN
    -- 1. Ownership immutability: Cannot reassign attempt to another user
    IF NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Security violation: Attempt ownership (user_id) cannot be modified.';
    END IF;

    -- 2. Test binding immutability: Cannot switch parent test
    IF NEW.test_id <> OLD.test_id THEN
        RAISE EXCEPTION 'Integrity violation: Attempt test_id cannot be modified.';
    END IF;

    -- 3. Started timestamp immutability
    IF NEW.started_at <> OLD.started_at THEN
        RAISE EXCEPTION 'Integrity violation: Attempt started_at cannot be modified.';
    END IF;

    -- 4. Assessment skill immutability: Cannot change assessment skill after creation
    IF OLD.assessment_type IS NOT NULL AND NEW.assessment_type IS DISTINCT FROM OLD.assessment_type THEN
        RAISE EXCEPTION 'Integrity violation: Attempt assessment_type cannot be altered once set.';
    END IF;

    -- 5. Terminal status immutability: SUBMITTED and DISCARDED attempts cannot be modified or reopened
    IF OLD.status IN ('SUBMITTED', 'DISCARDED') THEN
        IF NEW.status <> OLD.status 
           OR NEW.final_score IS DISTINCT FROM OLD.final_score 
           OR NEW.cefr_level IS DISTINCT FROM OLD.cefr_level 
           OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
            RAISE EXCEPTION 'Integrity violation: Finalized or discarded assessment attempts cannot be modified.';
        END IF;
    END IF;

    -- 6. Valid status transitions: From IN_PROGRESS, only SUBMITTED or DISCARDED are allowed
    IF OLD.status = 'IN_PROGRESS' THEN
        IF NEW.status NOT IN ('IN_PROGRESS', 'SUBMITTED', 'DISCARDED') THEN
            RAISE EXCEPTION 'Invalid status transition from IN_PROGRESS to %.', NEW.status;
        END IF;

        -- If discarded, final score and CEFR level must remain NULL
        IF NEW.status = 'DISCARDED' AND (NEW.final_score IS NOT NULL OR NEW.cefr_level IS NOT NULL) THEN
            RAISE EXCEPTION 'Integrity violation: Discarded attempts cannot have final scores or CEFR levels.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_attempt_state ON public.attempts;
CREATE TRIGGER trg_enforce_attempt_state
    BEFORE UPDATE ON public.attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_attempt_state_transition();

-- 2. Trigger function to enforce attempt creation defaults and prevent score forgery on INSERT
CREATE OR REPLACE FUNCTION public.enforce_attempt_insert_defaults()
RETURNS trigger AS $$
BEGIN
    -- For authenticated student callers, enforce security defaults
    IF auth.role() = 'authenticated' THEN
        NEW.user_id := auth.uid();
        NEW.status := 'IN_PROGRESS';
        NEW.started_at := timezone('utc'::text, now());
        NEW.submitted_at := NULL;
        NEW.final_score := NULL;
        NEW.cefr_level := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_attempt_insert ON public.attempts;
CREATE TRIGGER trg_enforce_attempt_insert
    BEFORE INSERT ON public.attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_attempt_insert_defaults();

-- 3. Direct Grants Configuration
-- Ensure anonymous clients have no access to attempts, responses, or evaluations
REVOKE ALL ON TABLE public.attempts FROM anon;
REVOKE ALL ON TABLE public.responses FROM anon;
REVOKE ALL ON TABLE public.listening_responses FROM anon;
REVOKE ALL ON TABLE public.writing_evaluations FROM anon;
REVOKE ALL ON TABLE public.speaking_evaluations FROM anon;

-- Ordinary authenticated students can SELECT their own attempts.
-- Column-level privilege restriction on INSERT: students can only provide user_id, test_id, assessment_type, status.
-- They CANNOT provide final_score, cefr_level, or submitted_at.
REVOKE ALL ON TABLE public.attempts FROM authenticated;
GRANT SELECT ON TABLE public.attempts TO authenticated;
GRANT INSERT (user_id, test_id, assessment_type, status) ON TABLE public.attempts TO authenticated;
GRANT UPDATE (status) ON TABLE public.attempts TO authenticated;

-- Students can manage their own responses during active testing
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.listening_responses TO authenticated;
GRANT SELECT ON TABLE public.writing_evaluations TO authenticated;
GRANT SELECT ON TABLE public.speaking_evaluations TO authenticated;

-- 4. Row Level Security Policies on public.attempts
-- Remove obsolete permissive policies
DROP POLICY IF EXISTS "Users can manage their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can read own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can update own in-progress attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can insert own in-progress attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can discard own in-progress attempts" ON public.attempts;

-- Authenticated students can view all of their own attempts (in-progress, submitted, discarded)
CREATE POLICY "Users can read own attempts" ON public.attempts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Authenticated students can only create new in-progress attempts for themselves with null scores
CREATE POLICY "Users can insert own in-progress attempts" ON public.attempts
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND status = 'IN_PROGRESS'
        AND final_score IS NULL
        AND cefr_level IS NULL
        AND submitted_at IS NULL
    );

-- Authenticated students can only update their own in-progress attempts to DISCARDED
CREATE POLICY "Users can discard own in-progress attempts" ON public.attempts
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'IN_PROGRESS')
    WITH CHECK (auth.uid() = user_id AND status = 'DISCARDED');

-- Note: Existing admin policy "Admins can select all attempts" is preserved untouched.

-- 5. Row Level Security Policies on public.responses (Reading MCQ)
DROP POLICY IF EXISTS "Users can manage responses for their attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can read responses for their attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can insert responses for in-progress attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can update responses for in-progress attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can delete responses for in-progress attempts" ON public.responses;

-- Allow reading responses for own attempts (needed for score review and results)
CREATE POLICY "Users can read responses for their attempts" ON public.responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = responses.attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- Allow inserting responses only while attempt is IN_PROGRESS
CREATE POLICY "Users can insert responses for in-progress attempts" ON public.responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

-- Allow updating responses only while attempt is IN_PROGRESS (required for UPSERT)
CREATE POLICY "Users can update responses for in-progress attempts" ON public.responses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = responses.attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

-- Allow deleting responses only while attempt is IN_PROGRESS
CREATE POLICY "Users can delete responses for in-progress attempts" ON public.responses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = responses.attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

-- Note: Existing admin policy "Admins can select all responses" is preserved untouched.

-- 6. Row Level Security Policies on public.listening_responses (Listening MCQ)
DROP POLICY IF EXISTS "Users can manage listening responses for their attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can read listening responses for their attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can insert listening responses for in-progress attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can update listening responses for in-progress attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can delete listening responses for in-progress attempts" ON public.listening_responses;

CREATE POLICY "Users can read listening responses for their attempts" ON public.listening_responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = listening_responses.attempt_id AND attempts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert listening responses for in-progress attempts" ON public.listening_responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

CREATE POLICY "Users can update listening responses for in-progress attempts" ON public.listening_responses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = listening_responses.attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

CREATE POLICY "Users can delete listening responses for in-progress attempts" ON public.listening_responses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = listening_responses.attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

-- Note: Existing admin policy "Admins can select all listening responses" is preserved untouched.

-- 7. Trusted Database Functions for Secure Assessment Finalization

-- 7a. Trusted Reading Assessment Submission
-- Re-scores answers strictly against canonical question answer keys.
-- Rejects incomplete submissions and arbitrary question IDs.
CREATE OR REPLACE FUNCTION public.submit_reading_attempt(p_attempt_id UUID)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_test_id UUID;
    v_status public.attempt_status;
    v_type public.section_type;
    v_total_required INTEGER;
    v_answered_count INTEGER;
    v_correct_count INTEGER;
    v_score NUMERIC;
    v_cefr VARCHAR;
    v_has_custom_assignments BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify attempt ownership, status, and assessment skill
    SELECT user_id, test_id, status, assessment_type
    INTO v_user_id, v_test_id, v_status, v_type
    FROM public.attempts
    WHERE id = p_attempt_id AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found or access denied';
    END IF;

    IF v_status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Attempt is not in progress';
    END IF;

    IF v_type IS NOT NULL AND v_type <> 'Reading' THEN
        RAISE EXCEPTION 'Attempt is not a Reading assessment';
    END IF;

    -- Determine required questions for this test attempt
    -- Priority 1: test_reading_questions junction table (active assignments)
    SELECT EXISTS (
        SELECT 1 FROM public.test_reading_questions
        WHERE test_id = v_test_id AND is_active = true
    ) INTO v_has_custom_assignments;

    CREATE TEMPORARY TABLE _required_reading_questions ON COMMIT DROP AS
    SELECT q.id AS question_id, q.correct_answer
    FROM public.questions q
    WHERE (
        v_has_custom_assignments = true AND q.id IN (
            SELECT trq.question_id
            FROM public.test_reading_questions trq
            WHERE trq.test_id = v_test_id AND trq.is_active = true
        )
    ) OR (
        v_has_custom_assignments = false AND q.section_id IN (
            SELECT s.id
            FROM public.sections s
            WHERE s.test_id = v_test_id AND s.type = 'Reading'
        )
    );

    SELECT COUNT(*) INTO v_total_required FROM _required_reading_questions;

    IF v_total_required = 0 THEN
        RAISE EXCEPTION 'Assessment configuration error: No questions configured for this test';
    END IF;

    -- Verify that the student did not submit answers for arbitrary questions outside this test
    IF EXISTS (
        SELECT 1 FROM public.responses r
        WHERE r.attempt_id = p_attempt_id
          AND r.question_id NOT IN (SELECT question_id FROM _required_reading_questions)
    ) THEN
        RAISE EXCEPTION 'Integrity violation: Responses contain questions not assigned to this test';
    END IF;

    -- Verify all required questions have been answered (Incomplete submissions rejected)
    SELECT COUNT(DISTINCT r.question_id)
    INTO v_answered_count
    FROM public.responses r
    JOIN _required_reading_questions rq ON rq.question_id = r.question_id
    WHERE r.attempt_id = p_attempt_id
      AND r.selected_answer IS NOT NULL
      AND TRIM(r.selected_answer) <> '';

    IF v_answered_count < v_total_required THEN
        RAISE EXCEPTION 'Assessment incomplete: % of % required questions answered', v_answered_count, v_total_required;
    END IF;

    -- Calculate correctness against real database answer keys (never trust client is_correct or score)
    -- Also sync responses table with verified is_correct and score values
    UPDATE public.responses r
    SET is_correct = (TRIM(LOWER(r.selected_answer)) = TRIM(LOWER(rq.correct_answer))),
        score = CASE WHEN (TRIM(LOWER(r.selected_answer)) = TRIM(LOWER(rq.correct_answer))) THEN 1 ELSE 0 END
    FROM _required_reading_questions rq
    WHERE r.attempt_id = p_attempt_id AND r.question_id = rq.question_id;

    SELECT COUNT(*)
    INTO v_correct_count
    FROM public.responses r
    JOIN _required_reading_questions rq ON rq.question_id = r.question_id
    WHERE r.attempt_id = p_attempt_id
      AND TRIM(LOWER(r.selected_answer)) = TRIM(LOWER(rq.correct_answer));

    -- Scoring calculation using total required questions as denominator
    v_score := ROUND((v_correct_count::numeric / v_total_required::numeric) * 100);

    -- Standard CEFR mapping
    IF v_score <= 20 THEN
        v_cefr := 'A1';
    ELSIF v_score <= 40 THEN
        v_cefr := 'A2';
    ELSIF v_score <= 60 THEN
        v_cefr := 'B1';
    ELSIF v_score <= 80 THEN
        v_cefr := 'B2';
    ELSIF v_score <= 90 THEN
        v_cefr := 'C1';
    ELSE
        v_cefr := 'C2';
    END IF;

    -- Finalize attempt
    UPDATE public.attempts
    SET status = 'SUBMITTED',
        final_score = v_score,
        cefr_level = v_cefr,
        submitted_at = timezone('utc'::text, now()),
        assessment_type = 'Reading'
    WHERE id = p_attempt_id;

    -- Sync user profile
    UPDATE public.users
    SET current_cefr_level = v_cefr,
        updated_at = timezone('utc'::text, now())
    WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'final_score', v_score,
        'cefr_level', v_cefr,
        'total_questions', v_total_required,
        'correct_answers', v_correct_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7b. Trusted Listening Assessment Submission
-- Re-scores answers strictly against canonical question answer keys.
-- Rejects incomplete submissions and arbitrary question IDs.
CREATE OR REPLACE FUNCTION public.submit_listening_attempt(p_attempt_id UUID)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_test_id UUID;
    v_status public.attempt_status;
    v_type public.section_type;
    v_total_required INTEGER;
    v_answered_count INTEGER;
    v_correct_count INTEGER;
    v_score NUMERIC;
    v_cefr VARCHAR;
    v_has_custom_passages BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT user_id, test_id, status, assessment_type
    INTO v_user_id, v_test_id, v_status, v_type
    FROM public.attempts
    WHERE id = p_attempt_id AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found or access denied';
    END IF;

    IF v_status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Attempt is not in progress';
    END IF;

    IF v_type IS NOT NULL AND v_type <> 'Listening' THEN
        RAISE EXCEPTION 'Attempt is not a Listening assessment';
    END IF;

    -- Determine required questions for this test attempt
    -- Priority 1: test_listening_passages junction table
    SELECT EXISTS (
        SELECT 1 FROM public.test_listening_passages
        WHERE test_id = v_test_id AND is_active = true
    ) INTO v_has_custom_passages;

    CREATE TEMPORARY TABLE _required_listening_questions ON COMMIT DROP AS
    SELECT lq.id AS question_id, lq.correct_answer
    FROM public.listening_questions lq
    WHERE (
        v_has_custom_passages = true AND lq.passage_id IN (
            SELECT tlp.passage_id
            FROM public.test_listening_passages tlp
            WHERE tlp.test_id = v_test_id AND tlp.is_active = true
        )
    ) OR (
        v_has_custom_passages = false AND lq.passage_id IN (
            SELECT lp.id
            FROM public.listening_passages lp
            JOIN public.sections s ON s.id = lp.section_id
            WHERE s.test_id = v_test_id AND s.type = 'Listening'
        )
    );

    SELECT COUNT(*) INTO v_total_required FROM _required_listening_questions;

    IF v_total_required = 0 THEN
        RAISE EXCEPTION 'Assessment configuration error: No listening questions configured for this test';
    END IF;

    -- Verify that the student did not submit answers for arbitrary questions outside this test
    IF EXISTS (
        SELECT 1 FROM public.listening_responses lr
        WHERE lr.attempt_id = p_attempt_id
          AND lr.question_id NOT IN (SELECT question_id FROM _required_listening_questions)
    ) THEN
        RAISE EXCEPTION 'Integrity violation: Responses contain questions not assigned to this test';
    END IF;

    -- Verify all required questions have been answered
    SELECT COUNT(DISTINCT lr.question_id)
    INTO v_answered_count
    FROM public.listening_responses lr
    JOIN _required_listening_questions lrq ON lrq.question_id = lr.question_id
    WHERE lr.attempt_id = p_attempt_id
      AND lr.selected_answer IS NOT NULL
      AND TRIM(lr.selected_answer) <> '';

    IF v_answered_count < v_total_required THEN
        RAISE EXCEPTION 'Assessment incomplete: % of % required questions answered', v_answered_count, v_total_required;
    END IF;

    -- Calculate correctness against real database answer keys (never trust client is_correct or score)
    -- Also sync listening_responses table with verified is_correct and score values
    UPDATE public.listening_responses lr
    SET is_correct = (TRIM(LOWER(lr.selected_answer)) = TRIM(LOWER(lrq.correct_answer))),
        score = CASE WHEN (TRIM(LOWER(lr.selected_answer)) = TRIM(LOWER(lrq.correct_answer))) THEN 1 ELSE 0 END
    FROM _required_listening_questions lrq
    WHERE lr.attempt_id = p_attempt_id AND lr.question_id = lrq.question_id;

    SELECT COUNT(*)
    INTO v_correct_count
    FROM public.listening_responses lr
    JOIN _required_listening_questions lrq ON lrq.question_id = lr.question_id
    WHERE lr.attempt_id = p_attempt_id
      AND TRIM(LOWER(lr.selected_answer)) = TRIM(LOWER(lrq.correct_answer));

    v_score := ROUND((v_correct_count::numeric / v_total_required::numeric) * 100);

    IF v_score <= 20 THEN
        v_cefr := 'A1';
    ELSIF v_score <= 40 THEN
        v_cefr := 'A2';
    ELSIF v_score <= 60 THEN
        v_cefr := 'B1';
    ELSIF v_score <= 80 THEN
        v_cefr := 'B2';
    ELSIF v_score <= 90 THEN
        v_cefr := 'C1';
    ELSE
        v_cefr := 'C2';
    END IF;

    UPDATE public.attempts
    SET status = 'SUBMITTED',
        final_score = v_score,
        cefr_level = v_cefr,
        submitted_at = timezone('utc'::text, now()),
        assessment_type = 'Listening'
    WHERE id = p_attempt_id;

    UPDATE public.users
    SET current_cefr_level = v_cefr,
        updated_at = timezone('utc'::text, now())
    WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'final_score', v_score,
        'cefr_level', v_cefr,
        'total_questions', v_total_required,
        'correct_answers', v_correct_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7c. Trusted Writing Evaluation Submission (Strictly service_role only)
-- Drop legacy function signature if present
DROP FUNCTION IF EXISTS public.submit_writing_evaluation(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.submit_writing_evaluation(
    p_attempt_id UUID,
    p_user_id UUID,
    p_essay_text TEXT,
    p_grammar_score NUMERIC,
    p_vocabulary_score NUMERIC,
    p_coherence_score NUMERIC,
    p_fluency_score NUMERIC,
    p_overall_score NUMERIC,
    p_cefr_level VARCHAR,
    p_feedback JSONB,
    p_raw_response JSONB
)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_status public.attempt_status;
    v_type public.section_type;
BEGIN
    -- Strict caller check: Only backend service_role client is permitted to invoke this function
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: submit_writing_evaluation can only be executed by service_role';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Student user_id is required';
    END IF;

    SELECT user_id, status, assessment_type
    INTO v_user_id, v_status, v_type
    FROM public.attempts
    WHERE id = p_attempt_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found or access denied';
    END IF;

    IF v_status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Attempt is not in progress';
    END IF;

    IF v_type IS NOT NULL AND v_type <> 'Writing' THEN
        RAISE EXCEPTION 'Attempt is not a Writing assessment';
    END IF;

    IF p_overall_score < 0 OR p_overall_score > 100 THEN
        RAISE EXCEPTION 'Invalid overall score: %', p_overall_score;
    END IF;

    -- Insert evaluation row
    INSERT INTO public.writing_evaluations (
        attempt_id,
        essay_text,
        grammar_score,
        vocabulary_score,
        coherence_score,
        fluency_score,
        overall_score,
        cefr_level,
        feedback,
        raw_response
    ) VALUES (
        p_attempt_id,
        p_essay_text,
        p_grammar_score,
        p_vocabulary_score,
        p_coherence_score,
        p_fluency_score,
        p_overall_score,
        p_cefr_level,
        p_feedback,
        p_raw_response
    );

    -- Finalize attempt
    UPDATE public.attempts
    SET status = 'SUBMITTED',
        final_score = p_overall_score,
        cefr_level = p_cefr_level,
        submitted_at = timezone('utc'::text, now()),
        assessment_type = 'Writing'
    WHERE id = p_attempt_id;

    -- Sync profile
    UPDATE public.users
    SET current_cefr_level = p_cefr_level,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'final_score', p_overall_score,
        'cefr_level', p_cefr_level
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7d. Trusted Speaking Evaluation Submission (Strictly service_role only)
-- Drop legacy function signature if present
DROP FUNCTION IF EXISTS public.submit_speaking_evaluation(UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.submit_speaking_evaluation(
    p_attempt_id UUID,
    p_user_id UUID,
    p_audio_url TEXT,
    p_transcript TEXT,
    p_pronunciation_score NUMERIC,
    p_grammar_score NUMERIC,
    p_fluency_score NUMERIC,
    p_vocabulary_score NUMERIC,
    p_overall_score NUMERIC,
    p_cefr_level VARCHAR,
    p_feedback JSONB,
    p_raw_response JSONB
)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_status public.attempt_status;
    v_type public.section_type;
BEGIN
    -- Strict caller check: Only backend service_role client is permitted to invoke this function
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: submit_speaking_evaluation can only be executed by service_role';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Student user_id is required';
    END IF;

    SELECT user_id, status, assessment_type
    INTO v_user_id, v_status, v_type
    FROM public.attempts
    WHERE id = p_attempt_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found or access denied';
    END IF;

    IF v_status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Attempt is not in progress';
    END IF;

    IF v_type IS NOT NULL AND v_type <> 'Speaking' THEN
        RAISE EXCEPTION 'Attempt is not a Speaking assessment';
    END IF;

    IF p_overall_score < 0 OR p_overall_score > 100 THEN
        RAISE EXCEPTION 'Invalid overall score: %', p_overall_score;
    END IF;

    INSERT INTO public.speaking_evaluations (
        attempt_id,
        audio_url,
        transcript,
        pronunciation_score,
        grammar_score,
        fluency_score,
        vocabulary_score,
        overall_score,
        cefr_level,
        feedback,
        raw_response
    ) VALUES (
        p_attempt_id,
        p_audio_url,
        p_transcript,
        p_pronunciation_score,
        p_grammar_score,
        p_fluency_score,
        p_vocabulary_score,
        p_overall_score,
        p_cefr_level,
        p_feedback,
        p_raw_response
    );

    UPDATE public.attempts
    SET status = 'SUBMITTED',
        final_score = p_overall_score,
        cefr_level = p_cefr_level,
        submitted_at = timezone('utc'::text, now()),
        assessment_type = 'Speaking'
    WHERE id = p_attempt_id;

    UPDATE public.users
    SET current_cefr_level = p_cefr_level,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'final_score', p_overall_score,
        'cefr_level', p_cefr_level
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Execution Grants
-- Reading and Listening: authenticated students can execute for their own attempt
REVOKE EXECUTE ON FUNCTION public.submit_reading_attempt(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_reading_attempt(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_listening_attempt(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_listening_attempt(UUID) TO authenticated;

-- Writing and Speaking: service_role ONLY; completely revoked from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.submit_writing_evaluation(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_writing_evaluation(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.submit_speaking_evaluation(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_speaking_evaluation(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, JSONB) TO service_role;
