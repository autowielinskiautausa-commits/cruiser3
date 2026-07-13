-- has_role is referenced inside RLS policies; the role evaluating the policy
-- (authenticated) must be able to EXECUTE it. A prior security migration
-- over-revoked this, breaking all role checks. Restore it for authenticated,
-- keep it revoked for anon/public.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
