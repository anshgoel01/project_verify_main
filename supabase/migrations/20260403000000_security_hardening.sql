-- SECURITY HARDENING: Restrict public data exposure

BEGIN;

-- 1. Restrict PROFILES table
-- Only allow authenticated users to see profiles.
-- We still allow 'full_name' etc. for authenticated users to see the leaderboard.
-- To really hide columns from anonymous users, we should not use SELECT USING (true) for anon at all.

DROP POLICY IF EXISTS "Profiles are viewable by anyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by anyone authenticated" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (true);

-- 2. Restrict SUBMISSIONS table
-- Currently viewable by anyone (SELECT USING (true)). 
-- Change this to authenticated users only.

DROP POLICY IF EXISTS "Submissions are viewable by anyone" ON public.submissions;

CREATE POLICY "Submissions are viewable by authenticated users"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (true);

-- 3. Enhance Admin Function Security
-- Ensure is_admin is not easily spoofable and has search_path set.
-- (Existing is_admin might already have it, but we reinforce it)

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'admin'
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
