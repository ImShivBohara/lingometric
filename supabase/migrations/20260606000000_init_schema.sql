-- supabase/migrations/20260606000000_init_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create custom types and ENUMs
CREATE TYPE public.user_role AS ENUM ('student', 'admin');
CREATE TYPE public.test_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.section_type AS ENUM ('Reading', 'Listening', 'Writing', 'Speaking');
CREATE TYPE public.difficulty_tier AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
CREATE TYPE public.attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- 2. Create Users Table
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR,
    avatar_url TEXT,
    role public.user_role NOT NULL DEFAULT 'student',
    current_cefr_level VARCHAR DEFAULT 'B1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- 3. Create Tests Table
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    is_adaptive BOOLEAN NOT NULL DEFAULT true,
    status public.test_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Sections Table
CREATE TABLE public.sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    type public.section_type NOT NULL,
    display_order INTEGER NOT NULL
);

-- 5. Create Questions Table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    question_type VARCHAR NOT NULL DEFAULT 'MCQ',
    difficulty_level public.difficulty_tier NOT NULL DEFAULT 'B1',
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    estimated_time_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Audio Files Table
CREATE TABLE public.audio_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    transcript TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Writing Prompts Table
CREATE TABLE public.writing_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    minimum_words INTEGER DEFAULT 50,
    maximum_words INTEGER DEFAULT 500,
    difficulty_level public.difficulty_tier NOT NULL DEFAULT 'B1'
);

-- 8. Create Speaking Prompts Table
CREATE TABLE public.speaking_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    expected_duration_seconds INTEGER DEFAULT 60,
    difficulty_level public.difficulty_tier NOT NULL DEFAULT 'B1'
);

-- 9. Create Attempts Table
CREATE TABLE public.attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    final_score NUMERIC CHECK (final_score >= 0 AND final_score <= 100),
    cefr_level VARCHAR,
    status public.attempt_status NOT NULL DEFAULT 'IN_PROGRESS'
);

-- Indexes for Attempts
CREATE INDEX idx_attempts_user ON public.attempts(user_id);
CREATE INDEX idx_attempts_test ON public.attempts(test_id);

-- 10. Create Responses Table
CREATE TABLE public.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    score NUMERIC DEFAULT 0,
    time_taken_seconds INTEGER
);

-- 11. Create Writing Evaluations Table
CREATE TABLE public.writing_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    essay_text TEXT NOT NULL,
    grammar_score NUMERIC CHECK (grammar_score >= 0 AND grammar_score <= 100),
    vocabulary_score NUMERIC CHECK (vocabulary_score >= 0 AND vocabulary_score <= 100),
    coherence_score NUMERIC CHECK (coherence_score >= 0 AND coherence_score <= 100),
    fluency_score NUMERIC CHECK (fluency_score >= 0 AND fluency_score <= 100),
    overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 100),
    cefr_level VARCHAR,
    feedback JSONB
);

-- 12. Create Speaking Evaluations Table
CREATE TABLE public.speaking_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    transcript TEXT,
    pronunciation_score NUMERIC CHECK (pronunciation_score >= 0 AND pronunciation_score <= 100),
    grammar_score NUMERIC CHECK (grammar_score >= 0 AND grammar_score <= 100),
    fluency_score NUMERIC CHECK (fluency_score >= 0 AND fluency_score <= 100),
    vocabulary_score NUMERIC CHECK (vocabulary_score >= 0 AND vocabulary_score <= 100),
    overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 100),
    cefr_level VARCHAR,
    feedback JSONB
);

-- 13. Create Certificates Table
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    certificate_code VARCHAR UNIQUE NOT NULL,
    pdf_url TEXT NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    verification_hash TEXT NOT NULL
);

-- 14. Create Analytics Events Table
CREATE TABLE public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Create Automatic User Creation Trigger on Auth.Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url, role, current_cefr_level)
    VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        new.raw_user_meta_data->>'avatar_url',
        'student'::public.user_role,
        'B1'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Prevent client-side profile updates from changing privileged or identity columns.
-- User-facing profile edits may update only non-privileged fields.
REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, current_cefr_level) ON TABLE public.users TO authenticated;

-- 17. Define RLS Policies

-- Users: Read profiles is public (or auth users only), updates only by owning user.
CREATE POLICY "Users can read profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Tests, Sections, Questions, Audio Files, Prompts: Read is public, modifications reserved for Admins.
CREATE POLICY "Public read tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Admin write tests" ON public.tests FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Admin write sections" ON public.sections FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admin write questions" ON public.questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read audio_files" ON public.audio_files FOR SELECT USING (true);
CREATE POLICY "Admin write audio_files" ON public.audio_files FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read writing_prompts" ON public.writing_prompts FOR SELECT USING (true);
CREATE POLICY "Admin write writing_prompts" ON public.writing_prompts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Public read speaking_prompts" ON public.speaking_prompts FOR SELECT USING (true);
CREATE POLICY "Admin write speaking_prompts" ON public.speaking_prompts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Attempts: User can only read and write their own attempts.
CREATE POLICY "Users can manage their own attempts" ON public.attempts
    FOR ALL USING (auth.uid() = user_id);

-- Responses: User can manage responses for their own attempts.
CREATE POLICY "Users can manage responses for their attempts" ON public.responses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = responses.attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- Writing & Speaking Evaluations: User can read evaluations for their own attempts.
CREATE POLICY "Users can read writing evaluations for their attempts" ON public.writing_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = writing_evaluations.attempt_id AND attempts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can read speaking evaluations for their attempts" ON public.speaking_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.attempts 
            WHERE attempts.id = speaking_evaluations.attempt_id AND attempts.user_id = auth.uid()
        )
    );

-- Certificates: Public read for verification shares, insert/update by Service Role only.
CREATE POLICY "Public read certificates" ON public.certificates
    FOR SELECT USING (true);

-- Analytics Events: Insert allowed by authenticated users, read limited to Admins.
CREATE POLICY "Users can insert their own analytics events" ON public.analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all analytics events" ON public.analytics_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    );
