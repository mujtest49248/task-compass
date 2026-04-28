-- Centralize the 'admin' role literal in one place
CREATE OR REPLACE FUNCTION public._admin_role()
RETURNS public.app_role
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 'admin'::public.app_role
$$;

REVOKE EXECUTE ON FUNCTION public._admin_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public._admin_role() TO authenticated;

-- Rewrite can_manage_tasks to use the helper
CREATE OR REPLACE FUNCTION public.can_manage_tasks(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, public._admin_role())
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND can_manage_tasks = true
    )
$$;

-- Rewrite RLS policies to use the helper instead of repeating 'admin'
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins manage permissions" ON public.user_permissions;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), public._admin_role()));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), public._admin_role()))
  WITH CHECK (public.has_role(auth.uid(), public._admin_role()));

CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), public._admin_role()));

CREATE POLICY "Admins manage permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), public._admin_role()))
  WITH CHECK (public.has_role(auth.uid(), public._admin_role()));