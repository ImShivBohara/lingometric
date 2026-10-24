-- supabase/migrations/20260606030000_listening_schema.sql
-- Create Listening tables and configure security/seeds

-- 1. Create listening_passages table
CREATE TABLE IF NOT EXISTS public.listening_passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    transcript TEXT,
    difficulty_level public.difficulty_tier NOT NULL DEFAULT 'B1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create listening_questions table
CREATE TABLE IF NOT EXISTS public.listening_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passage_id UUID NOT NULL REFERENCES public.listening_passages(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["Option A", "Option B"]
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create listening_responses table
CREATE TABLE IF NOT EXISTS public.listening_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.listening_questions(id) ON DELETE CASCADE,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    score NUMERIC DEFAULT 0,
    time_taken_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_attempt_listening_question UNIQUE (attempt_id, question_id)
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.listening_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_responses ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies
-- Public read for passages & questions; admin modifications only
CREATE POLICY "Public read listening_passages" ON public.listening_passages FOR SELECT USING (true);
CREATE POLICY "Admin write listening_passages" ON public.listening_passages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read listening_questions" ON public.listening_questions FOR SELECT USING (true);
CREATE POLICY "Admin write listening_questions" ON public.listening_questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Users can manage listening responses for their attempts" ON public.listening_responses
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- 6. Seed a baseline Listening passage and questions
-- Section ID for Listening is 'b4d70c5e-d63c-4384-a327-ee556c77d872'
INSERT INTO public.listening_passages (id, section_id, title, audio_url, duration_seconds, transcript, difficulty_level)
VALUES (
    'd4d70c5e-d63c-4384-a327-ee556c77d890',
    'b4d70c5e-d63c-4384-a327-ee556c77d872',
    'The Future of Renewable Energy',
    'https://womntytacqxlkihuojua.supabase.co/storage/v1/object/public/listening-audio/renewable_energy.mp3',
    180,
    'Welcome to today''s lecture on renewable energy. Today, we will discuss how solar, wind, and geothermal power are transforming our global grid. While solar energy remains the fastest-growing source, wind energy provides critical bulk power during nighttime hours. However, battery storage technologies are the true key to unlocking a 100% clean energy grid because they solve the issue of intermittency.',
    'B1'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.listening_questions (id, passage_id, question_text, options, correct_answer, explanation)
VALUES 
(
    'e4d70c5e-d63c-4384-a327-ee556c77d891',
    'd4d70c5e-d63c-4384-a327-ee556c77d890',
    'According to the speaker, what is the fastest-growing source of renewable energy?',
    '["Wind energy", "Solar energy", "Geothermal power", "Hydroelectric energy"]'::jsonb,
    'Solar energy',
    'The speaker explicitly states that "solar energy remains the fastest-growing source".'
),
(
    'e4d70c5e-d63c-4384-a327-ee556c77d892',
    'd4d70c5e-d63c-4384-a327-ee556c77d890',
    'What critical function does wind energy serve?',
    '["Providing bulk power during nighttime hours", "Reducing panel costs", "Eliminating the need for storage", "Pumping water"]'::jsonb,
    'Providing bulk power during nighttime hours',
    'The speaker notes that "wind energy provides critical bulk power during nighttime hours".'
),
(
    'e4d70c5e-d63c-4384-a327-ee556c77d893',
    'd4d70c5e-d63c-4384-a327-ee556c77d890',
    'Why are battery storage technologies considered the key to a 100% clean grid?',
    '["They are cheaper than panels", "They solve the issue of intermittency", "They generate wind power", "They last forever"]'::jsonb,
    'They solve the issue of intermittency',
    'The speaker states that battery storage is the key "because they solve the issue of intermittency".'
) ON CONFLICT (id) DO NOTHING;
