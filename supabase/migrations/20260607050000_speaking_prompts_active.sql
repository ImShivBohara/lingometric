-- supabase/migrations/20260607050000_speaking_prompts_active.sql
-- Add is_active column, migrate existing data, and enforce partial unique index constraints

-- 1. Add column is_active with default false
ALTER TABLE public.speaking_prompts
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- 2. Activate exactly one existing prompt per section (the oldest prompt based on ID sorting)
UPDATE public.speaking_prompts
SET is_active = true
WHERE id IN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY section_id
      ORDER BY id ASC
    ) AS rn
    FROM public.speaking_prompts
  ) t
  WHERE rn = 1
);

-- 3. Create partial unique index to restrict to a single active prompt per section
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_speaking_prompt_per_section
ON public.speaking_prompts(section_id)
WHERE is_active = true;
