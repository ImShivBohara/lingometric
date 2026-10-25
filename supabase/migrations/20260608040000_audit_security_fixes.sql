-- ==============================================================================
-- Migration: 20260608040000_audit_security_fixes.sql
-- Description: LingoMetric Final Submission Audit Fixes
--   1. Protect student profile info: Non-recursive RLS and grants on public.users.
--   2. Prevent CEFR editing: Restrict authenticated UPDATE to (full_name, avatar_url)
--      while preserving trusted SECURITY DEFINER scoring functions.
--   3. Tighten assessment content access: Revoke anon table access and require
--      authenticated session for reading tests, sections, passages, and prompts.
--   4. Preserve current production audio configuration and support reproducible fresh setup.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Non-Recursive Admin Authorization
-- ------------------------------------------------------------------------------
-- SECURITY DEFINER allows checking admin role without triggering recursive RLS
-- evaluation on public.users.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Protect public.users: Privacy & CEFR Immutability
-- ------------------------------------------------------------------------------
-- Unauthenticated users (anon) must not be able to retrieve user records or emails.
REVOKE ALL ON TABLE public.users FROM anon;

-- Ordinary authenticated users may only select allowed rows (via RLS)
-- and may only update non-privileged profile attributes (full_name, avatar_url).
-- current_cefr_level and role updates by client are strictly disallowed.
REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON TABLE public.users TO authenticated;

-- Replace permissive read policy with strictly scoped policies:
-- - Students can read only their own profile row.
-- - Admins retain full read access to student profiles for analytics/progress tracking.
DROP POLICY IF EXISTS "Users can read profiles" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;

CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.users
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. Protect Question Bank & Assessment Schema from Anonymous Scraping
-- ------------------------------------------------------------------------------
-- Unauthenticated requests (anon) must not scrape assessment items or answer keys.
REVOKE ALL ON TABLE public.questions FROM anon;
REVOKE ALL ON TABLE public.listening_questions FROM anon;
REVOKE ALL ON TABLE public.listening_passages FROM anon;
REVOKE ALL ON TABLE public.tests FROM anon;
REVOKE ALL ON TABLE public.sections FROM anon;
REVOKE ALL ON TABLE public.writing_prompts FROM anon;
REVOKE ALL ON TABLE public.speaking_prompts FROM anon;

GRANT SELECT ON TABLE public.questions TO authenticated;
GRANT SELECT ON TABLE public.listening_questions TO authenticated;
GRANT SELECT ON TABLE public.listening_passages TO authenticated;
GRANT SELECT ON TABLE public.tests TO authenticated;
GRANT SELECT ON TABLE public.sections TO authenticated;
GRANT SELECT ON TABLE public.writing_prompts TO authenticated;
GRANT SELECT ON TABLE public.speaking_prompts TO authenticated;

-- Tighten SELECT policies to authenticated users only
DROP POLICY IF EXISTS "Public read questions" ON public.questions;
CREATE POLICY "Authenticated read questions" ON public.questions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read listening_questions" ON public.listening_questions;
CREATE POLICY "Authenticated read listening_questions" ON public.listening_questions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read listening_passages" ON public.listening_passages;
CREATE POLICY "Authenticated read listening_passages" ON public.listening_passages
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read tests" ON public.tests;
CREATE POLICY "Authenticated read tests" ON public.tests
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read sections" ON public.sections;
CREATE POLICY "Authenticated read sections" ON public.sections
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read writing_prompts" ON public.writing_prompts;
CREATE POLICY "Authenticated read writing_prompts" ON public.writing_prompts
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read speaking_prompts" ON public.speaking_prompts;
CREATE POLICY "Authenticated read speaking_prompts" ON public.speaking_prompts
    FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------------------------
-- 4. Reproducible Audio Setup & Production Configuration Preservation
-- ------------------------------------------------------------------------------
-- Safe conditional documentation note:
-- The initial seed used a bootstrap storage URL (womntytacqxlkihuojua).
-- Current production audio configurations are strictly preserved.
-- For a fresh Supabase deployment, developers upload renewable_energy.mp3 to the
-- 'listening-audio' bucket and update the URL using:
--
-- UPDATE public.listening_passages
-- SET audio_url = 'https://<your-project-id>.supabase.co/storage/v1/object/public/listening-audio/renewable_energy.mp3'
-- WHERE id = 'd4d70c5e-d63c-4384-a327-ee556c77d890'
--   AND audio_url LIKE '%womntytacqxlkihuojua%';
-- ------------------------------------------------------------------------------
