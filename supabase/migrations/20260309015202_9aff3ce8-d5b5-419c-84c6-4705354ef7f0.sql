ALTER TABLE public.profiles ALTER COLUMN score TYPE numeric USING score::numeric;
ALTER TABLE public.profiles ALTER COLUMN score SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  UPDATE public.profiles
  SET
    total_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status != 'processing'),
    correct_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    score = (SELECT COALESCE(SUM(weight), 0) FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    updated_at = now()
  WHERE user_id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE profiles p
SET score = (
  SELECT COALESCE(SUM(s.weight), 0)
  FROM submissions s
  WHERE s.user_id = p.user_id
  AND s.status = 'correct'
);
