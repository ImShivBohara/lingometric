-- supabase/migrations/20260606020000_seed_writing_prompts.sql
-- Add raw_response for auditing/debugging and seed baseline writing prompt

-- 1. Add raw_response JSONB column to writing_evaluations if not already present
ALTER TABLE public.writing_evaluations 
ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- 2. Seed baseline Writing Prompt for the existing Writing Evaluation section
-- Section ID b4d70c5e-d63c-4384-a327-ee556c77d873 is 'Writing Evaluation' under Test a4d70c5e-d63c-4384-a327-ee556c77d870
INSERT INTO public.writing_prompts (id, section_id, prompt_text, minimum_words, maximum_words, difficulty_level)
VALUES (
    'd4d70c5e-d63c-4384-a327-ee556c77d891',
    'b4d70c5e-d63c-4384-a327-ee556c77d873',
    'Some people believe that university education should be free for everyone. Others think that students should pay for their higher education. Discuss both views and give your opinion.',
    100,
    400,
    'B2'
) ON CONFLICT (id) DO NOTHING;

-- 3. Add INSERT RLS Policies for writing_evaluations and speaking_evaluations
DROP POLICY IF EXISTS "Users can insert writing evaluations for their attempts" ON public.writing_evaluations;
CREATE POLICY "Users can insert writing evaluations for their attempts" ON public.writing_evaluations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert speaking evaluations for their attempts" ON public.speaking_evaluations;
CREATE POLICY "Users can insert speaking evaluations for their attempts" ON public.speaking_evaluations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid()
        )
    );
