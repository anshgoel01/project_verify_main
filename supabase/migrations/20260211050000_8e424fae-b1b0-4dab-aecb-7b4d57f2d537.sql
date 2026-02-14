
-- Drop the overly permissive update policy
DROP POLICY "Service role can update submissions" ON public.submissions;

-- The edge function will use the service role key which bypasses RLS entirely,
-- so we don't need an UPDATE policy for it. Regular users shouldn't update submissions.
