-- supabase/seeds.sql
-- Seed baseline test definitions for LinguaCert AI

-- 1. Insert a default published adaptive test
INSERT INTO public.tests (id, title, description, duration_minutes, is_adaptive, status)
VALUES (
    'a4d70c5e-d63c-4384-a327-ee556c77d870',
    'Standard Adaptive English Level Test',
    'A standardized multi-skill assessment evaluating Reading, Listening, Writing, and Speaking skills mapped to CEFR levels (A1 to C2).',
    50,
    true,
    'published'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert sections for the default test
INSERT INTO public.sections (id, test_id, name, type, display_order)
VALUES 
    ('b4d70c5e-d63c-4384-a327-ee556c77d871', 'a4d70c5e-d63c-4384-a327-ee556c77d870', 'Reading Comprehension', 'Reading', 1),
    ('b4d70c5e-d63c-4384-a327-ee556c77d872', 'a4d70c5e-d63c-4384-a327-ee556c77d870', 'Listening Comprehension', 'Listening', 2),
    ('b4d70c5e-d63c-4384-a327-ee556c77d873', 'a4d70c5e-d63c-4384-a327-ee556c77d870', 'Writing Evaluation', 'Writing', 3),
    ('b4d70c5e-d63c-4384-a327-ee556c77d874', 'a4d70c5e-d63c-4384-a327-ee556c77d870', 'Speaking Evaluation', 'Speaking', 4)
ON CONFLICT (id) DO NOTHING;
