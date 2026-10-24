-- supabase/migrations/20260606010000_seed_reading_questions.sql
-- Seed baseline Reading questions for LinguaCert AI

-- 1. Grammar MCQ
INSERT INTO public.questions (id, section_id, question_type, difficulty_level, question_text, options, correct_answer, explanation, estimated_time_seconds)
VALUES (
    'c4d70c5e-d63c-4384-a327-ee556c77d881',
    'b4d70c5e-d63c-4384-a327-ee556c77d871',
    'MCQ',
    'B1',
    'She ____ to the cinema yesterday.',
    '["go", "went", "going", "gone"]'::jsonb,
    'went',
    'The past simple tense of "go" is "went", which is used here because of the past time marker "yesterday".',
    20
) ON CONFLICT (id) DO NOTHING;

-- 2. Vocabulary MCQ
INSERT INTO public.questions (id, section_id, question_type, difficulty_level, question_text, options, correct_answer, explanation, estimated_time_seconds)
VALUES (
    'c4d70c5e-d63c-4384-a327-ee556c77d882',
    'b4d70c5e-d63c-4384-a327-ee556c77d871',
    'MCQ',
    'A2',
    'What is the closest synonym to the word "Vast"?',
    '["Small", "Huge", "Narrow", "Heavy"]'::jsonb,
    'Huge',
    '"Vast" means of very great extent or quantity; immense. The closest synonym is "Huge".',
    15
) ON CONFLICT (id) DO NOTHING;

-- 3. Sentence Completion
INSERT INTO public.questions (id, section_id, question_type, difficulty_level, question_text, options, correct_answer, explanation, estimated_time_seconds)
VALUES (
    'c4d70c5e-d63c-4384-a327-ee556c77d883',
    'b4d70c5e-d63c-4384-a327-ee556c77d871',
    'MCQ',
    'B2',
    'Although it was raining, they decided to ____ their walk.',
    '["continue", "cancel", "postpone", "prevent"]'::jsonb,
    'continue',
    '"Although" indicates a contrast. Despite the rain, they decided to keep walking ("continue").',
    30
) ON CONFLICT (id) DO NOTHING;

-- 4. Reading Comprehension Passage Question 1
INSERT INTO public.questions (id, section_id, question_type, difficulty_level, question_text, options, correct_answer, explanation, estimated_time_seconds)
VALUES (
    'c4d70c5e-d63c-4384-a327-ee556c77d884',
    'b4d70c5e-d63c-4384-a327-ee556c77d871',
    'MCQ',
    'B1',
    'Passage: "Computers have transformed the modern workplace, making communications nearly instantaneous. Employees can collaborate on global projects in real-time."\n\nQuestion: What is the main topic of the passage?',
    '["The history of computers", "The impact of computers on modern work", "Instant messaging apps", "Hardware design"]'::jsonb,
    'The impact of computers on modern work',
    'The passage discusses how computers transformed the modern workplace and collaboration, which represents their impact on work.',
    45
) ON CONFLICT (id) DO NOTHING;

-- 5. Reading Comprehension Passage Question 2
INSERT INTO public.questions (id, section_id, question_type, difficulty_level, question_text, options, correct_answer, explanation, estimated_time_seconds)
VALUES (
    'c4d70c5e-d63c-4384-a327-ee556c77d885',
    'b4d70c5e-d63c-4384-a327-ee556c77d871',
    'MCQ',
    'A2',
    'Passage: "Computers have transformed the modern workplace, making communications nearly instantaneous. Employees can collaborate on global projects in real-time."\n\nQuestion: According to the passage, what has become nearly instantaneous?',
    '["Communications", "Travel", "Data storage", "Calculations"]'::jsonb,
    'Communications',
    'The passage explicitly mentions: "...making communications nearly instantaneous."',
    30
) ON CONFLICT (id) DO NOTHING;
