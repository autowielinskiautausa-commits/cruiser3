-- Explicit restrictive policy: only admins may write to user_roles.
-- Restrictive policies are AND-combined with permissive ones, so this
-- hard-blocks any non-admin write path regardless of other policies.
CREATE POLICY "only admins can modify roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));