-- supabase/migrations/20260607030000_add_question_category.sql
-- Add category field to public.questions table

-- Add category column with default 'General'
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS category VARCHAR NOT NULL DEFAULT 'General';
