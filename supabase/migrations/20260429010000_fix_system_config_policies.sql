DROP POLICY IF EXISTS "Admin full access to system_config" ON public.system_config;
DROP POLICY IF EXISTS "Public read access to system_config" ON public.system_config;

CREATE POLICY "Public read access to system_config"
ON public.system_config FOR SELECT
USING (true);

CREATE POLICY "Admin full access to system_config"
ON public.system_config FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  )
);
