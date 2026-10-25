-- Keep legacy skill attempts intact; link new four-skill assessments explicitly.
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS session_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_session_skill
  ON public.attempts (session_id, assessment_type) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attempts_user_session ON public.attempts (user_id, session_id);

-- Session membership is assigned only by the trusted creation function.
CREATE OR REPLACE FUNCTION public.protect_attempt_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'Assessment session membership cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_attempt_session ON public.attempts;
CREATE TRIGGER trg_protect_attempt_session BEFORE UPDATE ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.protect_attempt_session();

CREATE OR REPLACE FUNCTION public.start_full_assessment(p_test_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tests WHERE id = p_test_id) THEN
    RAISE EXCEPTION 'Test not found';
  END IF;
  -- Serialize double clicks and concurrent starts for this user and test.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || p_test_id::text, 0));
  SELECT session_id INTO v_session FROM public.attempts a
  WHERE user_id = v_user AND test_id = p_test_id AND session_id IS NOT NULL
    AND status = 'IN_PROGRESS'
    AND NOT EXISTS (SELECT 1 FROM public.attempts d
                    WHERE d.session_id = a.session_id AND d.status = 'DISCARDED')
  ORDER BY started_at DESC LIMIT 1;
  IF v_session IS NULL THEN
    v_session := gen_random_uuid();
    INSERT INTO public.attempts (user_id, test_id, assessment_type, status, session_id)
    SELECT v_user, p_test_id, skill::public.section_type, 'IN_PROGRESS', v_session
    FROM unnest(ARRAY['Reading','Listening','Writing','Speaking']) AS skill;
  END IF;
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.start_full_assessment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_full_assessment(uuid) TO authenticated;
