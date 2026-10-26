-- Keep the start/resume lookups selective as attempts grow.
CREATE INDEX IF NOT EXISTS attempts_active_legacy_lookup
  ON public.attempts (user_id, test_id, assessment_type, started_at DESC)
  WHERE session_id IS NULL AND status = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS attempts_active_session_lookup
  ON public.attempts (user_id, test_id, session_id, started_at DESC)
  WHERE session_id IS NOT NULL AND status = 'IN_PROGRESS';