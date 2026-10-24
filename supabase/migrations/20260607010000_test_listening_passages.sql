-- supabase/migrations/20260607010000_test_listening_passages.sql
-- Create junction table test_listening_passages

CREATE TABLE IF NOT EXISTS public.test_listening_passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    passage_id UUID NOT NULL REFERENCES public.listening_passages(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_test_passage UNIQUE (test_id, passage_id)
);

-- Indexing for lookup efficiency
CREATE INDEX IF NOT EXISTS idx_test_listening_passages_test_id ON public.test_listening_passages(test_id);
CREATE INDEX IF NOT EXISTS idx_test_listening_passages_passage_id ON public.test_listening_passages(passage_id);

-- Enable RLS
ALTER TABLE public.test_listening_passages ENABLE ROW LEVEL SECURITY;

-- SELECT is public to align with tests/passages
CREATE POLICY "Public read test_listening_passages" ON public.test_listening_passages FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admin write test_listening_passages" ON public.test_listening_passages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
