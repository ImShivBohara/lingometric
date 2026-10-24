-- supabase/migrations/20260607020000_writing_prompts_active.sql
-- Alter writing_prompts table to support active status and migrate existing records safely

-- 1. Add is_active column with default false
ALTER TABLE public.writing_prompts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrate existing data: set exactly one prompt per section as active (oldest/smallest UUID id)
UPDATE public.writing_prompts
SET is_active = true
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY section_id ORDER BY id ASC) as rn
        FROM public.writing_prompts
    ) t WHERE t.rn = 1
);

-- 3. Create partial unique index to guarantee at most one active prompt per section
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_writing_prompt_per_section 
ON public.writing_prompts(section_id) 
WHERE is_active = true;
