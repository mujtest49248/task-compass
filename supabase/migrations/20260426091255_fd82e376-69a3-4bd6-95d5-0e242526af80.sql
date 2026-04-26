ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.tasks ALTER COLUMN threshold_type DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN threshold_text DROP NOT NULL;