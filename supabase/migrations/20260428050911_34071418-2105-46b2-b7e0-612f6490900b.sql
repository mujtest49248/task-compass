CREATE OR REPLACE FUNCTION public._admin_role()
RETURNS public.app_role
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT 'admin'::public.app_role
$$;