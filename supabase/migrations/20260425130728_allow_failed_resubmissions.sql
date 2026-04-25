-- Drop the existing unique constraint that blocked all resubmissions
DROP INDEX IF EXISTS public.idx_submissions_user_project_unique;

-- Recreate the unique constraint but only restrict 'correct' and 'processing' statuses.
-- This allows users to resubmit projects if their previous attempts failed/were rejected,
-- while still preventing them from having multiple 'correct' or 'processing' submissions for the same project.
CREATE UNIQUE INDEX idx_submissions_user_project_unique
  ON public.submissions (user_id, project_link)
  WHERE project_link IS NOT NULL AND status IN ('correct', 'processing');
