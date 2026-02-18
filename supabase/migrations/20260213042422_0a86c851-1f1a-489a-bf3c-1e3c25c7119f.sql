-- Allow service role (used by admin edge functions) to delete submissions
-- No RLS policy needed since edge functions use service_role key which bypasses RLS
-- But we need to ensure the trigger updates profile stats after delete

CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Handle both INSERT/UPDATE (NEW) and DELETE (OLD)
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  UPDATE public.profiles
  SET
    total_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status != 'processing'),
    correct_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    score = (SELECT COUNT(*) * 10 FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    updated_at = now()
  WHERE user_id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger to also fire on DELETE
DROP TRIGGER IF EXISTS update_profile_stats_trigger ON public.submissions;
CREATE TRIGGER update_profile_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_stats();
