
-- 1. RLS PERFORMANCE OPTIMIZATION (Subquery Wrappers)
-- We wrap auth.uid() and auth.role() in subqueries to prevent re-evaluation for every row.

-- 2. DUPLICATE RLS POLICIES CONSOLIDATION
-- We drop redundant/overlapping policies and recreate them with optimized logic.

BEGIN;

-- ==========================================
-- TABLE: profiles
-- ==========================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Profiles are viewable by anyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING ((SELECT auth.uid()) = user_id);


-- ==========================================
-- TABLE: submissions
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Everyone can view all submissions for leaderboard" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;

CREATE POLICY "Submissions are viewable by anyone" 
  ON public.submissions FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own submissions" 
  ON public.submissions FOR INSERT 
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ==========================================
-- TABLE: reports
-- ==========================================
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;

CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Consolidated select policy for reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));


-- ==========================================
-- TABLE: admin_requests
-- ==========================================
DROP POLICY IF EXISTS "Admins can view all requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Users can insert their own request" ON public.admin_requests;
DROP POLICY IF EXISTS "Users can view their own request" ON public.admin_requests;
DROP POLICY IF EXISTS "Admins can select admin_requests" ON public.admin_requests;

CREATE POLICY "Consolidated select policy for admin_requests"
  ON public.admin_requests FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

CREATE POLICY "Users can insert their own request"
  ON public.admin_requests FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can update requests"
  ON public.admin_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin((SELECT auth.uid())));


-- ==========================================
-- TABLE: user_roles
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can select user roles" ON public.user_roles;

CREATE POLICY "Consolidated select policy for user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));


-- ==========================================
-- TABLE: audit_logs
-- ==========================================
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can insert audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin((SELECT auth.uid())));


-- ==========================================
-- FUNCTION: handle_new_user SECURITY
-- ==========================================
-- We explicitly set a fixed search_path to prevent schema-hijacking attacks.
-- Even if the function is already defined with SET search_path, 
-- this ensures any future deployments are correct.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, college_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Student'), 
    new.email,
    COALESCE((new.raw_user_meta_data->>'college_id')::uuid, (SELECT id FROM public.colleges LIMIT 1))
  );
  
  -- Default role assignment can also happen here if needed:
  -- INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;


-- ==========================================
-- SECURITY: Leaked Password Protection
-- ==========================================
-- Enabling this via SQL is environment-dependent. 
-- In most Supabase hosted environments, this is a GoTrue config.
-- However, we provide the SQL representation if available in the auth schema.

DO $$
BEGIN
  -- Attempt to enable if auth.config table exists (some environments allow this via SQL)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'config') THEN
    UPDATE auth.config SET leaked_password_protection = true;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Access restricted, user should verify in Supabase Dashboard -> Auth -> Settings
  RAISE NOTICE 'Leaked Password Protection could not be set via SQL. Please enable in Supabase Dashboard.';
END $$;

COMMIT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
