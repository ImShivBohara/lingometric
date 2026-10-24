-- ============================================================================
-- Migration: 20260608020000_attempt_security_and_constraints.sql
-- Purpose: Enforce status transitions, immutability of attempt identity and ownership,
--          tighten RLS policies for attempts and responses, and configure table grants.
-- Execution Safety: Runs in a separate transaction after 20260608010000 has committed,
--                   allowing 'DISCARDED' enum values to be used in triggers and policies.
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

    -- 3. Assessment skill immutability: Cannot change assessment skill after creation
    IF OLD.assessment_type IS NOT NULL AND NEW.assessment_type IS DISTINCT FROM OLD.assessment_type THEN
        RAISE EXCEPTION 'Integrity violation: Attempt assessment_type cannot be altered once set.';
    END IF;

    -- 4. Terminal status immutability: SUBMITTED and DISCARDED attempts cannot be modified or reopened
    IF OLD.status IN ('SUBMITTED', 'DISCARDED') THEN
        IF NEW.status <> OLD.status 
           OR NEW.final_score IS DISTINCT FROM OLD.final_score 
           OR NEW.cefr_level IS DISTINCT FROM OLD.cefr_level 
           OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
            RAISE EXCEPTION 'Integrity violation: Finalized or discarded assessment attempts cannot be modified.';
        END IF;
    END IF;

    -- 5. Valid status transitions: From IN_PROGRESS, only SUBMITTED or DISCARDED are allowed
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_attempt_state ON public.attempts;
CREATE TRIGGER trg_enforce_attempt_state
    BEFORE UPDATE ON public.attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_attempt_state_transition();

-- 2. Tighten Row Level Security (RLS) policies on public.attempts
DROP POLICY IF EXISTS "Users can manage their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can read own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can update own in-progress attempts" ON public.attempts;

-- Authenticated students can view all of their own attempts (in-progress, submitted, discarded)
CREATE POLICY "Users can read own attempts" ON public.attempts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Authenticated students can create new in-progress attempts for themselves
CREATE POLICY "Users can insert own attempts" ON public.attempts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id AND status = 'IN_PROGRESS');

-- Authenticated students can only update their own in-progress attempts
CREATE POLICY "Users can update own in-progress attempts" ON public.attempts
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'IN_PROGRESS')
    WITH CHECK (auth.uid() = user_id);

-- 3. Tighten RLS policies on public.responses (Reading MCQ)
DROP POLICY IF EXISTS "Users can manage responses for their attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can read responses for their attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can insert responses for in-progress attempts" ON public.responses;
DROP POLICY IF EXISTS "Users can update responses for in-progress attempts" ON public.responses;

-- Allow reading responses for own attempts (needed for score summary & results display)
CREATE POLICY "Users can read responses for their attempts" ON public.responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = responses.attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- Allow inserting responses only while the attempt is IN_PROGRESS
CREATE POLICY "Users can insert responses for in-progress attempts" ON public.responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid() AND attempts.status = 'IN_PROGRESS'
        )
    );

-- Allow updating responses only while the attempt is IN_PROGRESS (required for UPSERT)
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

-- 4. Tighten RLS policies on public.listening_responses (Listening MCQ)
DROP POLICY IF EXISTS "Users can manage listening responses for their attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can read listening responses for their attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can insert listening responses for in-progress attempts" ON public.listening_responses;
DROP POLICY IF EXISTS "Users can update listening responses for in-progress attempts" ON public.listening_responses;

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

-- 5. Table grants configuration:
-- Students can select, insert, and update attempts and responses.
-- Direct row deletion on attempts is revoked (soft discard is required).
GRANT SELECT, INSERT, UPDATE ON TABLE public.attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.listening_responses TO authenticated;
REVOKE DELETE ON TABLE public.attempts FROM authenticated;
