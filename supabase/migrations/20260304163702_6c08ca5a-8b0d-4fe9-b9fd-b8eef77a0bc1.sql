
-- Add level and weight columns to submissions
ALTER TABLE public.submissions 
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT NULL;

-- Allow admins to update submissions (for setting weight overrides)
CREATE POLICY "Admins can update submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
