DROP POLICY IF EXISTS "authenticated view profiles" ON public.profiles;

CREATE POLICY "users view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));