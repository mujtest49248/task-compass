CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('K','R','O')),
  description TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL CHECK (value_type IN ('Numeric','String','Other')),
  collection_type TEXT NOT NULL CHECK (collection_type IN ('Manual','Auto')),
  frequency TEXT NOT NULL CHECK (frequency IN ('Daily','Weekly','Monthly','Quarterly','Yearly','Ad-hoc')),
  ad_hoc_date TEXT,
  threshold_numeric DOUBLE PRECISION,
  threshold_text TEXT NOT NULL DEFAULT '',
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('MIN','MAX','Exact')),
  assignee TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tasks" ON public.tasks FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tasks_task_id ON public.tasks(task_id);