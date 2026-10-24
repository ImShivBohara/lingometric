-- supabase/migrations/20260607000000_seed_speaking_prompts.sql
-- Configure Speaking Assessment tables, policies, and seed prompts

-- 1. Add raw_response column to speaking_evaluations if not exists
ALTER TABLE public.speaking_evaluations 
ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- 2. Configure RLS INSERT policy for speaking_evaluations
-- (Select policy already exists in init_schema.sql)
DROP POLICY IF EXISTS "Users can insert speaking evaluations for their attempts" ON public.speaking_evaluations;
CREATE POLICY "Users can insert speaking evaluations for their attempts" ON public.speaking_evaluations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- 3. Seed baseline Speaking Prompt
-- Section ID for Speaking is 'b4d70c5e-d63c-4384-a327-ee556c77d874'
INSERT INTO public.speaking_prompts (id, section_id, prompt_text, expected_duration_seconds, difficulty_level)
VALUES (
    'f4d70c5e-d63c-4384-a327-ee556c77d899',
    'b4d70c5e-d63c-4384-a327-ee556c77d874',
    'Describe a place you have visited that made a strong impression on you. You should explain: where this place is, what you did there, and why it left such a lasting impression.',
    60,
    'B2'
) ON CONFLICT (id) DO NOTHING;

-- 4. Configure RLS SELECT policy for admin on attempts
DROP POLICY IF EXISTS "Admins can select all attempts" ON public.attempts;
CREATE POLICY "Admins can select all attempts" ON public.attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
