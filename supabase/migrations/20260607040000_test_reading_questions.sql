-- supabase/migrations/20260607040000_test_reading_questions.sql
-- Create junction table test_reading_questions

CREATE TABLE IF NOT EXISTS public.test_reading_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_test_reading_question UNIQUE (test_id, question_id)
);

-- Indexing for lookup efficiency
CREATE INDEX IF NOT EXISTS idx_test_reading_questions_test_id ON public.test_reading_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_reading_questions_question_id ON public.test_reading_questions(question_id);

-- Enable RLS
ALTER TABLE public.test_reading_questions ENABLE ROW LEVEL SECURITY;

-- SELECT is public to align with tests and questions read operations
CREATE POLICY "Public read test_reading_questions" ON public.test_reading_questions 
FOR SELECT USING (true);

-- Admin write access guard
CREATE POLICY "Admin write test_reading_questions" ON public.test_reading_questions 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);
