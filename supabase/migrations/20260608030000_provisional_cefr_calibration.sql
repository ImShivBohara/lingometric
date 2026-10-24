-- ============================================================================
-- Migration: 20260608030000_provisional_cefr_calibration.sql
-- Description: Calibrate CEFR evaluation logic for short diagnostic assessments
--              in LingoMetric.
--
-- Safety Guarantees:
-- 1. Preserves 100% accurate percentage scoring (0-100%) and database answer-key verification.
-- 2. Distinguishes raw assessment accuracy from overall language proficiency.
-- 3. Short modular screeners (~5 Reading items up to B2, 3 Listening items on B1 passage)
--    report provisional/indicative baseline tiers rather than misleading C1/C2 certification.
-- 4. Never overwrites or modifies historical attempt records.
-- 5. Additive function replacement; does not modify Phase 1 migration files.
-- ============================================================================

-- 1. Trusted Reading Assessment Submission (Calibrated Provisional CEFR)
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

    -- Verify that responses contain only assigned questions
    IF EXISTS (
        SELECT 1 FROM public.responses r
        WHERE r.attempt_id = p_attempt_id
          AND r.question_id NOT IN (SELECT question_id FROM _required_reading_questions)
    ) THEN
        RAISE EXCEPTION 'Integrity violation: Responses contain questions not assigned to this test';
    END IF;

    -- Verify all required questions have been answered
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

    -- Calculate correctness strictly against canonical answer keys
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

    -- Exact percentage accuracy score
    v_score := ROUND((v_correct_count::numeric / v_total_required::numeric) * 100);

    -- Calibrated Provisional CEFR mapping for short reading diagnostic screener:
    -- Preserves canonical A1 -> C2 progression order.
    -- Short 5-question test assesses A2 to B2 items; full score indicates B2 mastery ceiling
    -- rather than certifying C1/C2 proficiency.
    IF v_score <= 20 THEN
        v_cefr := 'A1';
    ELSIF v_score <= 45 THEN
        v_cefr := 'A2';
    ELSIF v_score <= 75 THEN
        v_cefr := 'B1';
    ELSE
        v_cefr := 'B2';
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
        'correct_answers', v_correct_count,
        'provisional', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trusted Listening Assessment Submission (Calibrated Provisional CEFR)
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

    IF EXISTS (
        SELECT 1 FROM public.listening_responses lr
        WHERE lr.attempt_id = p_attempt_id
          AND lr.question_id NOT IN (SELECT question_id FROM _required_listening_questions)
    ) THEN
        RAISE EXCEPTION 'Integrity violation: Responses contain questions not assigned to this test';
    END IF;

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

    -- Calibrated Provisional CEFR mapping for short listening diagnostic screener:
    -- The passage is at baseline B1 difficulty. A 3-question passage test evaluates
    -- foundational comprehension of standard input; capped at B1 indicative.
    IF v_score < 34 THEN
        v_cefr := 'A1';
    ELSIF v_score < 67 THEN
        v_cefr := 'A2';
    ELSE
        v_cefr := 'B1';
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
        'correct_answers', v_correct_count,
        'provisional', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
