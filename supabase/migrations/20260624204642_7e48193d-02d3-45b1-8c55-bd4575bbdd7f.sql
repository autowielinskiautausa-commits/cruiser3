-- Remove leftover legacy user-management function (no trigger uses it anymore).
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Simplify user_roles write policies: keep a single clear model.
-- Drop the redundant permissive ALL policy that duplicates the restrictive ones.
DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;

-- Ensure the role-write policies exist and are clean (idempotent recreate).
DROP POLICY IF EXISTS "only admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins delete roles" ON public.user_roles;

CREATE POLICY "only admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- SELECT stays: users read their own role, admins read all (policy already exists).
