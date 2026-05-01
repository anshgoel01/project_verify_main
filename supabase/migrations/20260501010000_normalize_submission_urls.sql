-- Normalize submission URLs so query parameters or extra trailing slashes
-- cannot be used to bypass duplicate-submission checks.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_submission_url(input_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT regexp_replace(
           regexp_replace(
             CASE
               WHEN input_url ~* '^https?://' THEN trim(input_url)
               ELSE 'https://' || ltrim(trim(input_url), '/')
             END,
             '[?#].*$',
             ''
           ),
           '/+$',
           ''
         );
$$;

DELETE FROM public.submissions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, public.normalize_submission_url(coursera_link)
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.submissions
    WHERE status IN ('correct', 'processing')
      AND coursera_link IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM public.submissions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, public.normalize_submission_url(project_link)
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.submissions
    WHERE status IN ('correct', 'processing')
      AND project_link IS NOT NULL
  ) ranked
  WHERE rn > 1
);

UPDATE public.submissions
SET
  coursera_link = public.normalize_submission_url(coursera_link),
  project_link = CASE
    WHEN project_link IS NULL THEN NULL
    ELSE public.normalize_submission_url(project_link)
  END,
  linkedin_link = public.normalize_submission_url(linkedin_link)
WHERE coursera_link IS NOT NULL
   OR project_link IS NOT NULL
   OR linkedin_link IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_submission_urls_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.coursera_link := public.normalize_submission_url(NEW.coursera_link);
  NEW.project_link := CASE
    WHEN NEW.project_link IS NULL THEN NULL
    ELSE public.normalize_submission_url(NEW.project_link)
  END;
  NEW.linkedin_link := public.normalize_submission_url(NEW.linkedin_link);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_submission_urls_trigger ON public.submissions;
CREATE TRIGGER normalize_submission_urls_trigger
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_submission_urls_trigger();

DROP INDEX IF EXISTS public.idx_submissions_user_project_unique;
CREATE UNIQUE INDEX idx_submissions_user_project_unique
  ON public.submissions (user_id, project_link)
  WHERE project_link IS NOT NULL AND status IN ('correct', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_user_coursera_unique
  ON public.submissions (user_id, coursera_link)
  WHERE coursera_link IS NOT NULL AND status IN ('correct', 'processing');

COMMIT;
