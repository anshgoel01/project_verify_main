-- Optimize submissions table for 5000-10000+ rows
-- Indexes for common queries: user submissions, profile stats, admin filters, ordering

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id_status ON public.submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_college_id ON public.submissions (college_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at_desc ON public.submissions (created_at DESC);

-- Remove user delete policy: users can no longer delete their own submissions
DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.submissions;
