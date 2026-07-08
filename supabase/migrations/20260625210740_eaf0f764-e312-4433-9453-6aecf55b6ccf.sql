-- Public function: does any admin exist?
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role)
$$;

REVOKE ALL ON FUNCTION public.admin_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

-- Harden new-user handling: only the first account may register, and only
-- while no admin exists. Reopens automatically if all admins are removed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block any registration once an administrator already exists.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Rejestracja jest zamknięta — administrator już istnieje.';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- First account becomes the administrator (bootstrap).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();