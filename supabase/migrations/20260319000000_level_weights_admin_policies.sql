-- supabase/migrations/20260319000000_level_weights_admin_policies.sql

CREATE POLICY "Admins can insert level_weights"
ON public.default_weights
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update level_weights"
ON public.default_weights
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));