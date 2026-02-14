
-- Colleges table
CREATE TABLE public.colleges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Colleges are viewable by everyone" ON public.colleges FOR SELECT USING (true);

-- Seed some colleges
INSERT INTO public.colleges (name) VALUES
  ('IIT Bombay'), ('IIT Delhi'), ('IIT Madras'), ('IIT Kanpur'), ('IIT Kharagpur'),
  ('NIT Trichy'), ('NIT Warangal'), ('NIT Surathkal'), ('BITS Pilani'), ('VIT Vellore'),
  ('SRM Chennai'), ('Amity University'), ('Manipal University'), ('DTU Delhi'), ('NSUT Delhi');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  college_id UUID NOT NULL REFERENCES public.colleges(id),
  score INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  correct_submissions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id),
  coursera_link TEXT NOT NULL,
  linkedin_link TEXT NOT NULL,
  coursera_name TEXT,
  linkedin_username TEXT,
  coursera_course TEXT,
  student_match BOOLEAN,
  course_match BOOLEAN,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'correct', 'wrong', 'skipped', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Allow the service role (edge function) to update submissions
CREATE POLICY "Service role can update submissions" ON public.submissions FOR UPDATE USING (true);
-- Allow everyone to read submissions for leaderboard context
CREATE POLICY "Everyone can view all submissions for leaderboard" ON public.submissions FOR SELECT USING (true);

-- Trigger to update profiles when submissions change
CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    total_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = NEW.user_id AND status != 'processing'),
    correct_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = NEW.user_id AND status = 'correct'),
    score = (SELECT COUNT(*) * 10 FROM public.submissions WHERE user_id = NEW.user_id AND status = 'correct'),
    updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_profile_stats_trigger
AFTER INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_stats();

-- Enable realtime for leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
