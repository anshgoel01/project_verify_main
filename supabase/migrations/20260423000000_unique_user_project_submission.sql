-- ============================================================
-- Prevent duplicate submissions: one submission per user per project
-- ============================================================

-- Step 1: Clean up existing duplicates, keeping only the earliest submission per (user_id, project_link)
DELETE FROM public.submissions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, project_link) id
  FROM public.submissions
  WHERE project_link IS NOT NULL
  ORDER BY user_id, project_link, created_at ASC
)
AND project_link IS NOT NULL
AND id IN (
  SELECT id FROM public.submissions s2
  WHERE EXISTS (
    SELECT 1 FROM public.submissions s3
    WHERE s3.user_id = s2.user_id
      AND s3.project_link = s2.project_link
      AND s3.created_at < s2.created_at
  )
);

-- Step 2: Add unique constraint on (user_id, project_link) for non-null project_links
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_user_project_unique
  ON public.submissions (user_id, project_link)
  WHERE project_link IS NOT NULL;
