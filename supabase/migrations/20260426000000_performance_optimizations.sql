-- Optimize leaderboard queries: prevents full table scan and in-memory sort
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard 
ON public.profiles (score DESC, updated_at ASC) 
WHERE score > 0;

-- Optimize the daily submissions chart query in AdminStats
CREATE INDEX IF NOT EXISTS idx_submissions_correct_daily 
ON public.submissions (created_at ASC) 
WHERE status = 'correct';

-- RPC Function for Admin Dashboard Stats
-- Moves heavy aggregation from client to the database
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_students INT;
  total_subs INT;
  level_counts JSON;
  daily_counts JSON;
BEGIN
  -- Count total students
  SELECT COUNT(*) INTO total_students FROM public.profiles;
  
  -- Count total submissions
  SELECT COALESCE(SUM(total_submissions), 0) INTO total_subs FROM public.profiles;

  -- Get level distribution for correct submissions
  SELECT json_object_agg(level, count) INTO level_counts
  FROM (
    SELECT COALESCE(level, 'Beginner') as level, COUNT(*) as count
    FROM public.submissions
    WHERE status = 'correct'
    GROUP BY COALESCE(level, 'Beginner')
  ) t;

  -- Get daily counts for last 14 days
  SELECT json_agg(row_to_json(d)) INTO daily_counts
  FROM (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM public.submissions
    WHERE status = 'correct' 
      AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  ) d;

  RETURN json_build_object(
    'totalStudents', total_students,
    'totalSubmissions', total_subs,
    'levelCounts', COALESCE(level_counts, '{}'::json),
    'dailyCounts', COALESCE(daily_counts, '[]'::json)
  );
END;
$$;
